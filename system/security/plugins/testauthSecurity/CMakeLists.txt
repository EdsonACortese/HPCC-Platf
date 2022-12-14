################################################################################
#    HPCC SYSTEMS software Copyright (C) 2022 HPCC Systems®.
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


# Component: testauthSecurity
#####################################################
# Description:
# ------------
#    Cmake Input File for testauthSecurity
#####################################################

project( testauthSecurity )

set (    SRCS
         ${HPCC_SOURCE_DIR}/system/security/shared/authmap.cpp
         ${CMAKE_CURRENT_SOURCE_DIR}/testauthSecurity.cpp
    )

include_directories (
         ${HPCC_SOURCE_DIR}/system/include
         ${HPCC_SOURCE_DIR}/system/security/shared
         ${HPCC_SOURCE_DIR}/system/jlib
    )

ADD_DEFINITIONS( -DTESTAUTHSECURITY_EXPORTS -D_USRDLL )

HPCC_ADD_LIBRARY( testauthSecurity SHARED ${SRCS} )
install ( TARGETS testauthSecurity RUNTIME DESTINATION ${EXEC_DIR} LIBRARY DESTINATION ${LIB_DIR} )
target_link_libraries ( testauthSecurity
         jlib
    )


