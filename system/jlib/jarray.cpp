/*##############################################################################

    HPCC SYSTEMS software Copyright (C) 2012 HPCC Systems®.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
############################################################################## */


#include "jiface.hpp"
#include "jarray.hpp"
#include "jsort.hpp"
#include "jmisc.hpp"
#include "jlib.hpp"

#include <assert.h>

constexpr unsigned ARRAY_FIRST_CHUNK_SIZE=8;
constexpr unsigned ARRAY_CHUNK_DOUBLE_LIMIT=0x100000;          // must be a power of 2
constexpr unsigned ARRAY_ALLOCA_LIMIT=64;

void Allocator::_space(size32_t iSize)
{
    if ( used == max )
        _reallocate(used+1, iSize);
    used++;
}

void Allocator::_ensure(aindex_t req, size32_t iSize)
{
    if (req > max )
        _reallocateExact(req, iSize);
}


void Allocator::kill()
{
    if (_head)
    {
        free(_head);
        _init();
    }
}

void Allocator::_reallocate(aindex_t newLen, size32_t itemSize)
{
    size32_t newMax = max;
    if (newMax == 0)
        newMax = ARRAY_FIRST_CHUNK_SIZE;
    if (newLen > ARRAY_CHUNK_DOUBLE_LIMIT)
    {
        newMax = (newLen + ARRAY_CHUNK_DOUBLE_LIMIT) & ~(ARRAY_CHUNK_DOUBLE_LIMIT-1);
        if (newLen >= newMax) // wraparound
        {
            IERRLOG("Out of memory (overflow) in Array allocator: itemSize = %u, trying to allocate %u items", itemSize, newLen);
            throw MakeStringException(0, "Out of memory (overflow) in Array allocator: itemSize = %u, trying to allocate %u items",itemSize, newLen);
        }
    }
    else
    {
        while (newLen > newMax)
            newMax += newMax;
    }
    size_t allocSize = (size_t)itemSize * newMax;
    if (allocSize < newMax)
    {
        IERRLOG("Out of memory (overflow) in Array allocator: itemSize = %u, trying to allocate %u items", itemSize, newLen);
        throw MakeStringException(0, "Out of memory (overflow) in Array allocator: itemSize = %u, trying to allocate %u items",itemSize, newLen);
    }
    void *newhead = realloc(_head, allocSize);
    if (!newhead) 
    {
        IERRLOG("Out of memory in Array allocator: itemSize = %u, trying to allocate %u items", itemSize, max);
        throw MakeStringException(0, "Out of memory in Array allocator: itemSize = %u, trying to allocate %u items",itemSize, max);
    }
    max = newMax;
    _head = newhead;
};


void Allocator::_reallocateExact(aindex_t newLen, size32_t itemSize)
{
    if (max == newLen)
        return;

    if (used > newLen)
        throw MakeStringException(0, "Reallocate an array would contain too few items: itemSize = %u, trying to allocate %u items contains %u",itemSize, newLen, used);

    size_t allocSize = (size_t)itemSize * newLen;
    void *newhead = realloc(_head, allocSize);
    if (!newhead)
    {
        IERRLOG("Out of memory in Array allocator: itemSize = %u, trying to allocate %u items", itemSize, max);
        throw MakeStringException(0, "Out of memory in Array allocator: itemSize = %u, trying to allocate %u items",itemSize, max);
    }
    max = newLen;
    _head = newhead;
};


void Allocator::_doRotateR(aindex_t pos1, aindex_t pos2, size32_t iSize, aindex_t numItems)
{
    size32_t saveSize = numItems * iSize;
    size32_t blockSize = (pos2+1-pos1) * iSize;
    if (blockSize == saveSize)
        return;
    assertex(blockSize > saveSize);

    char * head= (char *)_head;
    char * lower = head + pos1 * iSize;
    char * upper = lower + (blockSize - saveSize);
    char * temp = (char *)((saveSize <= ARRAY_ALLOCA_LIMIT) ? alloca(saveSize) : malloc(saveSize));

    memcpy(temp, upper, saveSize);
    memmove(lower + saveSize, lower, blockSize-saveSize);
    memcpy(lower, temp, saveSize);

    if (saveSize > ARRAY_ALLOCA_LIMIT)
        free(temp);
}

void Allocator::_doRotateL(aindex_t pos1, aindex_t pos2, size32_t iSize, size32_t numItems)
{
    size32_t saveSize = numItems * iSize;
    size32_t blockSize = (pos2+1-pos1) * iSize;
    if (blockSize == saveSize)
        return;
    assertex(blockSize > saveSize);

    char * head= (char *)_head;
    char * lower = head + pos1 * iSize;
    char * upper = lower + (blockSize - saveSize);
    char * temp = (char *)((saveSize <= ARRAY_ALLOCA_LIMIT) ? alloca(saveSize) : malloc(saveSize));

    memcpy(temp, lower, saveSize);
    memmove(lower, lower + saveSize, blockSize - saveSize);
    memcpy(upper, temp, saveSize);

    if (saveSize > ARRAY_ALLOCA_LIMIT)
        free(temp);
}


void Allocator::_doSwap(aindex_t pos1, aindex_t pos2, size32_t iSize)
{
    char * head= (char *)_head;
    char * lower = head + pos1 * iSize;
    char * upper = head + pos2 * iSize;
    
    char * temp = (char *)alloca(iSize);
    memcpy(temp, lower, iSize);
    memmove(lower, upper, iSize );
    memcpy(upper, temp, iSize);
}



void Allocator::_doTransfer(aindex_t to, aindex_t from, size32_t iSize)
{
    if (from != to)
    {
        if (from < to)
            _doRotateL(from, to, iSize, 1);
        else
            _doRotateR(to, from, iSize, 1);
    }
}



void * Allocator::_doBAdd(void * newItem, size32_t _size, StdCompare compare, bool & isNew)
{
    return ::binary_add(newItem, _head, used-1, _size, compare, &isNew);
}


void * Allocator::_doBSearch(const void * key, size32_t _size, StdCompare compare) const
{
    return bsearch(key, _head, used, _size, compare);
}


void Allocator::_doSort(size32_t _size, StdCompare compare)
{
    if (used > 1)
        qsort(_head, used, _size, compare);
}

void Allocator::doSwapWith(Allocator & other)
{
    void * saveHead = _head;
    _head = other._head;
    other._head = saveHead;
    aindex_t saveUsed = used;
    used = other.used;
    other.used = saveUsed;
    aindex_t saveMax = max;
    max = other.max;
    other.max = saveMax;
}

