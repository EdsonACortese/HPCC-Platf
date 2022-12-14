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

#ifndef DASESS_HPP
#define DASESS_HPP

#ifdef DALI_EXPORTS
#define da_decl DECL_EXPORT
#else
#define da_decl DECL_IMPORT
#endif

#ifdef _WIN32
#pragma warning(disable : 4786)
#endif

#include "dacoven.hpp"
#include "jtime.hpp"

typedef DALI_UID SessionId;
typedef DALI_UID SubscriptionId;
typedef DALI_UID SecurityToken;  // currently use 0

#define SESSID_DALI_SERVER ((SessionId)-1)   // used with subscribeSession


#define FIXED_HT_SIZE 4096 // elements
#define FIXED_KEY_SIZE 24

// NB: careful not to reorder existing enumerated roles, for backward compatibility reasons
enum DaliClientRole // if changed must update queryRoleName()
{
    DCR_Unknown,
    DCR_Private,
    DCR_Deprecated1,
    DCR_ThorSlave,
    DCR_ThorMaster,
    DCR_Deprecated2, // legacy role
    DCR_Deprecated3, // legacy role
    DCR_Deprecated4, // legacy role
    DCR_EclServer,
    DCR_EclAgent,
    DCR_DaliServer, // special (self)
    DCR_SashaServer,
    DCR_Deprecated5,
    DCR_Deprecated6,
    DCR_DfuServer,
    DCR_EspServer,
    DCR_Deprecated7,
    DCR_Config,
    DCR_Deprecated8,
    DCR_Roxie,
    DCR_Deprecated9,
    DCR_Deprecated10,
    DCR_BackupGen,
    DCR_AgentExec,
    DCR_EclScheduler,
    DCR_EclCCServer,
    DCR_EclCC,
    DCR_DaFsControl,
    DCR_SwapNode,
    DCR_DaliAdmin,
    DCR_UpdateEnv,
    DCR_TreeView,
    DCR_DaliDiag,
    DCR_ScheduleAdmin,
    DCR_Testing,
    DCR_XRef,
    DCR_EclMinus,
    DCR_Monitoring,
    DCR_DaliStop,
    DCR_Max
};

interface IUserDescriptor: extends serializable
{
    virtual StringBuffer &getUserName(StringBuffer &buf)=0;
    virtual StringBuffer &getPassword(StringBuffer &buf)=0;
    virtual const char *querySignature()=0;//user's digital signature
    virtual void set(const char *name,const char *password)=0;
    virtual void set(const char *name,const char *password, const char *_signature)=0;
    virtual void clear()=0;
    virtual void serializeWithoutPassword(MemoryBuffer &mb)=0;
};

extern da_decl IUserDescriptor *createUserDescriptor();
extern da_decl IUserDescriptor *createUserDescriptor(MemoryBuffer &mb);

constexpr IUserDescriptor * unknownUser = NULL;//use of this should be avoided
#define UNKNOWN_USER (IUserDescriptor*)unknownUser

interface ISessionNotify: extends IInterface
{
    virtual void closed(SessionId id) = 0;
    virtual void aborted(SessionId id) = 0;
};

enum SecAccessFlags : int;

interface ISessionManager: extends IInterface
{
    virtual SessionId startSession(SecurityToken tok, SessionId parentid =-1) = 0;

    virtual void stopSession(SessionId, bool failed) = 0;   // session no longer valid after call

    virtual bool sessionStopped(SessionId, unsigned timeout) = 0;

    virtual SubscriptionId subscribeSession(SessionId id, ISessionNotify *inotify) = 0;
    virtual void unsubscribeSession(SubscriptionId id) = 0; // called from separate thread

    virtual SessionId lookupProcessSession(INode *node=NULL) = 0; // no parameters - get my session ID
    virtual INode *getProcessSessionNode(SessionId id) =0;        // if session not running returns null

    virtual StringBuffer &getClientProcessList(StringBuffer &buf)=0; // for diagnostics
    virtual StringBuffer &getClientProcessEndpoint(SessionId id,StringBuffer &buf)=0; // for diagnostics
    virtual unsigned queryClientCount() = 0; // for SNMP

    virtual SecAccessFlags getPermissionsLDAP(const char *key,const char *obj,IUserDescriptor *udesc,unsigned auditflags, int *err=NULL)=0;
    virtual bool checkScopeScansLDAP()=0;
    virtual unsigned getLDAPflags()=0;
    virtual void setLDAPflags(unsigned flags)=0;
    virtual bool clearPermissionsCache(IUserDescriptor *udesc)=0;
    virtual bool queryScopeScansEnabled(IUserDescriptor *udesc, int * err, StringBuffer &retMsg)=0;
    virtual bool enableScopeScans(IUserDescriptor *udesc, bool enable, int * err, StringBuffer &retMsg)=0;
};

// the following are getPermissionsLDAP input flags for audit reporting
#define DALI_LDAP_AUDIT_REPORT              (1)         // required to check
#define DALI_LDAP_READ_WANTED               (2)
#define DALI_LDAP_WRITE_WANTED              (4)

#define HASREADPERMISSION(p)        (((p) & (NewSecAccess_Access | NewSecAccess_Read)) == (NewSecAccess_Access | NewSecAccess_Read))
#define HASWRITEPERMISSION(p)       (((p) & (NewSecAccess_Access | NewSecAccess_Write)) == (NewSecAccess_Access | NewSecAccess_Write))


extern da_decl ISessionManager &querySessionManager();

#define myProcessSession() (querySessionManager().lookupProcessSession())

interface IMessageWrapper
{
public:
    virtual void serializeReq(CMessageBuffer &mb) = 0;
    virtual void deserializeReq(CMessageBuffer &mb) = 0;
};

// for server use
interface IDaliServer;
interface IPropertyTree;
interface IFile;
interface IDaliLdapConnection;
interface IDaliClientAuthConnection;
extern da_decl IDaliServer *createDaliSessionServer(); // called for coven members
extern da_decl void setLDAPconnection(IDaliLdapConnection *ldapconn); // called for coven members
extern da_decl void setClientAuth(IDaliClientAuthConnection *authconn); // called for coven members
extern da_decl const char *queryRoleName(DaliClientRole role);
extern da_decl DaliClientRole queryRole(const char *roleStr);

#endif
