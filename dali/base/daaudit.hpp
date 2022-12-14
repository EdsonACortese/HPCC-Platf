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

#ifndef DAAUDIT_HPP
#define DAAUDIT_HPP

#ifdef DALI_EXPORTS
#define da_decl DECL_EXPORT
#else
#define da_decl DECL_IMPORT
#endif

class CDateTime;
extern da_decl unsigned queryAuditLogs(const CDateTime &from,const CDateTime &to, const char *mask,StringAttrArray &out,unsigned start=0,unsigned max=100000);


// for server use
interface IDaliServer;
extern da_decl IDaliServer *createDaliAuditServer(const char *dir); // called for coven members

#endif
