################################################################################
#    HPCC SYSTEMS software Copyright (C) 2012 HPCC Systems®.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.
################################################################################

# Component: lzma 

#####################################################
# Description:
# ------------
#    Cmake Input File for lzma
#####################################################


project( lzma )
SET(CMAKE_UNITY_BUILD FALSE)
set ( SRCS
        LzFind.cpp
        LzmaDec.cpp
        LzmaEnc.cpp
)

include_directories ( 
        ${HPCC_SOURCE_DIR}/system/include
    )

ADD_DEFINITIONS( -D_LIB )

SET_SOURCE_FILES_PROPERTIES( ${SRCS} PROPERTIES LANGUAGE CXX )
HPCC_ADD_LIBRARY( lzma STATIC ${SRCS} )

