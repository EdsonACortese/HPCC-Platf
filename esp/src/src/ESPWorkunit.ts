﻿import * as declare from "dojo/_base/declare";
import * as arrayUtil from "dojo/_base/array";
import * as lang from "dojo/_base/lang";
import "dojo/i18n";
// @ts-ignore
import * as nlsHPCC from "dojo/i18n!hpcc/nls/hpcc";
import * as Deferred from "dojo/_base/Deferred";
import * as all from "dojo/promise/all";
import * as Observable from "dojo/store/Observable";
import * as topic from "dojo/topic";

import { Workunit as HPCCWorkunit } from "@hpcc-js/comms";
import { IEvent } from "@hpcc-js/util";

import * as Utility from "./Utility";
import * as WsWorkunits from "./WsWorkunits";
import * as WsTopology from "./WsTopology";
import * as ESPUtil from "./ESPUtil";
import * as ESPRequest from "./ESPRequest";
import * as ESPResult from "./ESPResult";

declare const dojo;

var _workunits = {};

export function getStateIconClass(stateID: number, complete: boolean, archived: boolean): string {
    if (archived) {
        return "iconArchived";
    }
    switch (stateID) {
        case 1:
            if (complete) {
                return "iconCompleted";
            }
            return "iconSubmitted";
        case 3:
            return "iconCompleted";
        case 2:
        case 11:
        case 15:
            return "iconRunning";
        case 4:
        case 7:
            return "iconFailed";
        case 5:
        case 8:
        case 10:
        case 12:
        case 13:
        case 14:
        case 16:
            return "iconArchived";
        case 6:
            return "iconAborting";
        case 9:
            return "iconSubmitted";
        case 999:
            return "iconDeleted";
    }
    return "iconWorkunit";
}

export function getStateImageName(stateID: number, complete: boolean, archived: boolean): string {
    if (archived) {
        return "workunit_archived.png";
    }
    switch (stateID) {
        case 1:
            if (complete) {
                return "workunit_completed.png";
            }
            return "workunit_submitted.png";
        case 2:
            return "workunit_running.png";
        case 3:
            return "workunit_completed.png";
        case 4:
            return "workunit_failed.png";
        case 5:
            return "workunit_warning.png";
        case 6:
            return "workunit_aborting.png";
        case 7:
            return "workunit_failed.png";
        case 8:
            return "workunit_warning.png";
        case 9:
            return "workunit_submitted.png";
        case 10:
            return "workunit_warning.png";
        case 11:
            return "workunit_running.png";
        case 12:
            return "workunit_warning.png";
        case 13:
            return "workunit_warning.png";
        case 14:
            return "workunit_warning.png";
        case 15:
            return "workunit_running.png";
        case 16:
            return "workunit_warning.png";
        case 999:
            return "workunit_deleted.png";
    }
    return "workunit.png";
}
export function getStateImage(stateID: number, complete: boolean, archived: boolean): string {
    return Utility.getImageURL(getStateImageName(stateID, complete, archived));
}

export function getStateImageHTML(stateID: number, complete: boolean, archived: boolean): string {
    return Utility.getImageHTML(getStateImageName(stateID, complete, archived));
}

var Store = declare([ESPRequest.Store], {
    service: "WsWorkunits",
    action: "WUQuery",
    responseQualifier: "WUQueryResponse.Workunits.ECLWorkunit",
    responseTotalQualifier: "WUQueryResponse.NumWUs",
    idProperty: "Wuid",
    startProperty: "PageStartFrom",
    countProperty: "Count",

    constructor: function () {
        this._watched = {};
    },
    preRequest: function (request) {
        if (request.Sortby && request.Sortby === "TotalClusterTime") {
            request.Sortby = "ClusterTime";
        }
        this.busy = true;
    },
    preProcessFullResponse: function (response, request, query, options) {
        this.busy = false;
        this._toUnwatch = lang.mixin({}, this._watched);
    },
    create: function (id) {
        return new Workunit({
            Wuid: id
        });
    },
    update: function (id, item) {
        var storeItem = this.get(id);
        storeItem.updateData(item);
        if (!this._watched[id]) {
            var context = this;
            this._watched[id] = storeItem.watch("__hpcc_changedCount", function (name, oldValue, newValue) {
                if (oldValue !== newValue) {
                    context.notify(storeItem, id);
                }
            });
        } else {
            delete this._toUnwatch[id];
        }
    },
    postProcessResults: function () {
        for (var key in this._toUnwatch) {
            this._toUnwatch[key].unwatch();
            delete this._watched[key];
        }
        delete this._toUnwatch;
    }
});

var Workunit = declare([ESPUtil.Singleton], {  // jshint ignore:line
    i18n: nlsHPCC,

    //  Asserts  ---
    _assertHasWuid: function () {
        if (!this.Wuid) {
            throw new Error("Wuid cannot be empty.");
        }
    },
    //  Attributes  ---
    _StateIDSetter: function (StateID) {
        this.StateID = StateID;
        var actionEx = lang.exists("ActionEx", this) ? this.ActionEx : null;
        this.set("hasCompleted", WsWorkunits.isComplete(this.StateID, actionEx));
    },
    _ActionExSetter: function (ActionEx) {
        if (this.StateID) {
            this.ActionEx = ActionEx;
            this.set("hasCompleted", WsWorkunits.isComplete(this.StateID, this.ActionEx));
        }
    },
    _hasCompletedSetter: function (completed) {
        var justCompleted = !this.hasCompleted && completed;
        this.hasCompleted = completed;
        if (justCompleted) {
            topic.publish("hpcc/ecl_wu_completed", this);
        }
        if (!this.hasCompleted && this.component !== "ActivityWidget") {
            this.startMonitor();
        }
    },
    _VariablesSetter: function (Variables) {
        this.set("variables", Variables.ECLResult);
    },
    _ResultsSetter: function (Results) {
        var results = [];
        var sequenceResults = [];
        var namedResults = {};
        for (var i = 0; i < Results.ECLResult.length; ++i) {
            var espResult = ESPResult.Get(lang.mixin({
                wu: this.wu,
                Wuid: this.Wuid,
                ResultViews: lang.exists("ResultViews.View", Results) ? Results.ResultViews.View : []
            }, Results.ECLResult[i]));
            results.push(espResult);
            sequenceResults[Results.ECLResult[i].Sequence] = espResult;
            if (Results.ECLResult[i].Name) {
                namedResults[Results.ECLResult[i].Name] = espResult;
            }
        }
        this.set("results", results);
        this.set("sequenceResults", sequenceResults);
        this.set("namedResults", namedResults);
    },
    _SourceFilesSetter: function (SourceFiles) {
        var sourceFiles = [];
        for (var i = 0; i < SourceFiles.ECLSourceFile.length; ++i) {
            sourceFiles.push(ESPResult.Get(lang.mixin({ wu: this.wu, Wuid: this.Wuid, __hpcc_parentName: "" }, SourceFiles.ECLSourceFile[i])));
            if (lang.exists("ECLSourceFiles.ECLSourceFile", SourceFiles.ECLSourceFile[i])) {
                for (var j = 0; j < SourceFiles.ECLSourceFile[i].ECLSourceFiles.ECLSourceFile.length; ++j) {
                    sourceFiles.push(ESPResult.Get(lang.mixin({ wu: this.wu, Wuid: this.Wuid, __hpcc_parentName: SourceFiles.ECLSourceFile[i].Name }, SourceFiles.ECLSourceFile[i].ECLSourceFiles.ECLSourceFile[j])));
                }
            }
        }
        this.set("sourceFiles", sourceFiles);
    },
    _TimersSetter: function (Timers) {
        var timers = [];
        for (var i = 0; i < Timers.ECLTimer.length; ++i) {
            var secs = Utility.espTime2Seconds(Timers.ECLTimer[i].Value);
            timers.push(lang.mixin(Timers.ECLTimer[i], {
                __hpcc_id: i + 1,
                Seconds: Math.round(secs * 1000) / 1000,
                HasSubGraphId: Timers.ECLTimer[i].SubGraphId && Timers.ECLTimer[i].SubGraphId !== "" ? true : false
            }));
        }
        this.set("timers", timers);
    },
    _ResourceURLsSetter: function (resourceURLs) {
        var data = [];
        arrayUtil.forEach(resourceURLs.URL, function (url, idx) {
            var cleanedURL = url.split("\\").join("/");
            var urlParts = cleanedURL.split("/");
            var matchStr = "res/" + this.wu.Wuid + "/";
            if (cleanedURL.indexOf(matchStr) === 0) {
                var displayPath = cleanedURL.substr(matchStr.length);
                var displayName = urlParts[urlParts.length - 1];
                var row = {
                    __hpcc_id: idx,
                    DisplayName: displayName,
                    DisplayPath: displayPath,
                    URL: cleanedURL
                };
                data.push(row);
            }
        }, this);
        this.set("resourceURLs", data);
        this.set("resourceURLCount", data.length);
    },
    _GraphsSetter: function (Graphs) {
        this.set("graphs", Graphs.ECLGraph);
    },

    //  Calculated "Helpers"  ---
    _HelpersSetter: function (Helpers) {
        this.set("helpers", Helpers.ECLHelpFile);
        this.refreshHelpersCount();
    },
    _ThorLogListSetter: function (ThorLogList) {
        this.set("thorLogInfo", ThorLogList.ThorLogInfo);
        this.getThorLogStatus(ThorLogList);
        this.refreshHelpersCount();
    },
    _HasArchiveQuerySetter: function (HasArchiveQuery) {
        this.set("hasArchiveQuery", HasArchiveQuery);
        this.refreshHelpersCount();
    },
    refreshHelpersCount: function () {
        var eclwatchHelpersCount = 2;   //  ECL + Workunit XML are also helpers...
        if (this.helpers) {
            eclwatchHelpersCount += this.helpers.length;
        }
        if (this.thorLogList) {
            eclwatchHelpersCount += this.thorLogList.length;
        }
        if (this.hasArchiveQuery) {
            eclwatchHelpersCount += 1;
        }
        this.set("eclwatchHelpersCount", eclwatchHelpersCount);
    },

    //  ---  ---  ---
    onCreate: function () {
    },
    onUpdate: function () {
    },
    onSubmit: function () {
    },
    constructor: ESPUtil.override(function (inherited, args) {
        inherited(arguments);
        if (args) {
            declare.safeMixin(this, args);
        }
        this.wu = this;
        this._hpccWU = HPCCWorkunit.attach({ baseUrl: "" }, this.Wuid);
    }),
    isComplete: function () {
        return this.hasCompleted;
    },
    isFailed: function () {
        return this.StateID === 4;
    },
    isDeleted: function () {
        return this.StateID === 999;
    },
    isBlocked: function () {
        return this.StateID === 8;
    },
    isAbleToDeschedule: function () {
        return this.EventSchedule === 2;
    },
    isAbleToReschedule: function () {
        return this.EventSchedule === 1;
    },
    isMonitoring: function (): boolean {
        return !!this._hpccWatchHandle;
    },
    disableMonitor: function (disableMonitor: boolean) {
        if (disableMonitor) {
            this.stopMonitor();
        } else {
            this.startMonitor();
        }
    },
    startMonitor: function () {
        if (this.isMonitoring())
            return;
        this._hpccWatchHandle = this._hpccWU.watch((changes: IEvent[]) => {
            this.updateData(this._hpccWU.properties);
        }, true);
    },
    stopMonitor: function () {
        if (this._hpccWatchHandle) {
            this._hpccWatchHandle.release();
            delete this._hpccWatchHandle;
        }
    },
    monitor: function (callback) {
        if (callback) {
            callback(this);
        }
        if (!this.hasCompleted) {
            var context = this;
            if (this._watchHandle) {
                this._watchHandle.unwatch();
            }
            this._watchHandle = this.watch("__hpcc_changedCount", function (name, oldValue, newValue) {
                if (oldValue !== newValue && newValue) {
                    if (callback) {
                        callback(context);
                    }
                }
            });
        }
    },
    doDeschedule: function () {
        return this._action("Deschedule").then(function (response) {
        });
    },
    doReschedule: function () {
        return this._action("Reschedule").then(function (response) {
        });
    },
    create: function (ecl) {
        var context = this;
        WsWorkunits.WUCreate({
            load: function (response) {
                if (lang.exists("Exceptions.Exception", response)) {
                    dojo.publish("hpcc/brToaster", {
                        message: "<h4>" + response.Exceptions.Source + "</h4>" + "<p>" + response.Exceptions.Exception[0].Message + "</p>",
                        type: "error",
                        duration: -1
                    });
                } else {
                    _workunits[response.WUCreateResponse.Workunit.Wuid] = context;
                    context.Wuid = response.WUCreateResponse.Workunit.Wuid;
                    context._hpccWU = HPCCWorkunit.attach({ baseUrl: "" }, context.Wuid);
                    context.startMonitor(true);
                    context.updateData(response.WUCreateResponse.Workunit);
                    context.onCreate();
                }
            }
        });
    },
    update: function (request, appData) {
        this._assertHasWuid();
        lang.mixin(request, {
            Wuid: this.Wuid
        });
        lang.mixin(request, {
            StateOrig: this.State,
            JobnameOrig: this.Jobname,
            DescriptionOrig: this.Description,
            ProtectedOrig: this.Protected,
            ScopeOrig: this.Scope,
            ClusterOrig: this.Cluster,
            ApplicationValues: appData
        });

        var context = this;
        WsWorkunits.WUUpdate({
            request: request,
            load: function (response) {
                if (lang.exists("Exceptions.Exception", response)) {
                    dojo.publish("hpcc/brToaster", {
                        message: "<h4>" + response.Exceptions.Source + "</h4>" + "<p>" + response.Exceptions.Exception[0].Message + "</p>",
                        type: "error",
                        duration: -1
                    });
                } else {
                    context.updateData(response.WUUpdateResponse.Workunit);
                }
                context.onUpdate();
            }
        });
    },
    submit: function (target) {
        this._assertHasWuid();
        var context = this;
        var deferred = new Deferred()
        deferred.promise.then(function (target) {
            WsWorkunits.WUSubmit({
                request: {
                    Wuid: context.Wuid,
                    Cluster: target
                },
                load: function (response) {
                    context.onSubmit();
                }
            });
        });

        if (target) {
            deferred.resolve(target);
        } else {
            WsTopology.TpLogicalClusterQuery().then(function (response) {
                if (lang.exists("TpLogicalClusterQueryResponse.default", response)) {
                    deferred.resolve(response.TpLogicalClusterQueryResponse["default"].Name);
                }
            });
        }
    },
    _resubmit: function (clone, resetWorkflow) {
        this._assertHasWuid();
        var context = this;
        return WsWorkunits.WUResubmit({
            request: {
                Wuids: this.Wuid,
                CloneWorkunit: clone,
                ResetWorkflow: resetWorkflow
            }
        }).then(function (response) {
            context.refresh();
            return response;
        });
    },
    clone: function () {
        var context = this;
        this._resubmit(true, false).then(function (response) {
            if (!lang.exists("Exceptions.Source", response)) {
                var msg = "";
                if (lang.exists("WUResubmitResponse.WUs.WU", response) && response.WUResubmitResponse.WUs.WU.length) {
                    msg = context.i18n.ClonedWUID + ":  " + response.WUResubmitResponse.WUs.WU[0].WUID;
                    topic.publish("hpcc/ecl_wu_created", {
                        wuid: response.WUResubmitResponse.WUs.WU[0].WUID
                    });
                }
                dojo.publish("hpcc/brToaster", {
                    Severity: "Message",
                    Source: "ESPWorkunit.clone",
                    Exceptions: [{ Source: context.Wuid, Message: msg }]
                });
            }
            return response;
        });
    },
    resubmit: function () {
        var context = this;
        this._resubmit(false, true).then(function (response) {
            if (!lang.exists("Exceptions.Source", response)) {
                dojo.publish("hpcc/brToaster", {
                    Severity: "Message",
                    Source: "ESPWorkunit.resubmit",
                    Exceptions: [{ Source: context.Wuid, Message: context.i18n.Resubmitted }]
                });
                context.hasCompleted = false;
                context.startMonitor(true);
            }
            return response;
        });
    },
    recover: function () {
        var context = this;
        this._resubmit(false, false).then(function (response) {
            if (!lang.exists("Exceptions.Source", response)) {
                dojo.publish("hpcc/brToaster", {
                    Severity: "Message",
                    Source: "ESPWorkunit.recover",
                    Exceptions: [{ Source: context.Wuid, Message: context.i18n.Restarted }]
                });
                context.hasCompleted = false;
                context.startMonitor(true);
            }
            return response;
        });
    },
    _action: function (action) {
        this._assertHasWuid();
        var context = this;
        return WsWorkunits.WUAction([{ Wuid: this.Wuid }], action, {
            load: function (response) {
                context.refresh();
            }
        });
    },
    setToFailed: function () {
        return this._action("setToFailed");
    },
    pause: function () {
        return this._action("Pause");
    },
    pauseNow: function () {
        return this._action("PauseNow");
    },
    resume: function () {
        return this._action("Resume");
    },
    abort: function () {
        return this._action("Abort");
    },
    doDelete: function () {
        return this._action("Delete").then(function (response) {
        });
    },

    restore: function () {
        return this._action("Restore");
    },

    publish: function (jobName, remoteDali, sourceProcess, priority, comment, allowForeign, updateSupers) {
        this._assertHasWuid();
        var context = this;
        WsWorkunits.WUPublishWorkunit({
            request: {
                Wuid: this.Wuid,
                JobName: jobName,
                RemoteDali: remoteDali,
                SourceProcess: sourceProcess,
                Priority: priority,
                Comment: comment,
                AllowForeignFiles: allowForeign,
                UpdateSuperFiles: updateSupers,
                Activate: 1,
                UpdateWorkUnitName: 1,
                Wait: 5000
            },
            load: function (response) {
                context.updateData(response.WUPublishWorkunitResponse);
            }
        });
    },
    refresh: function (full) {
        return this._hpccWU.refresh(full || this.Archived || this.__hpcc_changedCount === 0).then(wu => {
            this.updateData(wu.properties);
            return wu.properties;
        });
    },
    getQuery: function () {
        this._assertHasWuid();
        var context = this;
        return WsWorkunits.WUQuery({
            request: {
                Wuid: this.Wuid
            }
        }).then(function (response) {
            if (lang.exists("WUQueryResponse.Workunits.ECLWorkunit", response)) {
                arrayUtil.forEach(response.WUQueryResponse.Workunits.ECLWorkunit, function (item, index) {
                    context.updateData(item);
                });
            }
            return response;
        });
    },
    getInfo: function (args) {
        this._assertHasWuid();
        var context = this;
        return WsWorkunits.WUInfo({
            request: {
                Wuid: this.Wuid,
                TruncateEclTo64k: args.onGetText ? false : true,
                IncludeExceptions: args.onGetWUExceptions ? true : false,
                IncludeGraphs: args.onGetGraphs ? true : false,
                IncludeSourceFiles: args.onGetSourceFiles ? true : false,
                IncludeResults: (args.onGetResults || args.onGetSequenceResults) ? true : false,
                IncludeResultsViewNames: (args.onGetResults || args.onGetSequenceResults) ? true : false,
                IncludeVariables: args.onGetVariables ? true : false,
                IncludeTimers: args.onGetTimers ? true : false,
                IncludeResourceURLs: args.onGetResourceURLs ? true : false,
                IncludeDebugValues: args.onGetDebugValues ? true : false,
                IncludeApplicationValues: args.onGetApplicationValues ? true : false,
                IncludeWorkflows: args.onGetWorkflows ? true : false,
                IncludeXmlSchemas: false,
                SuppressResultSchemas: true
            }
        }).then(function (response) {
            if (lang.exists("WUInfoResponse.Workunit", response)) {
                if (!args.onGetText && lang.exists("WUInfoResponse.Workunit.Query", response)) {
                    //  A truncated version of ECL just causes issues  ---
                    delete response.WUInfoResponse.Workunit.Query;
                }
                if (lang.exists("WUInfoResponse.ResultViews", response) && lang.exists("WUInfoResponse.Workunit.Results", response)) {
                    lang.mixin(response.WUInfoResponse.Workunit.Results, {
                        ResultViews: response.WUInfoResponse.ResultViews
                    });
                }
                if (args.onGetWUExceptions && !lang.exists("WUInfoResponse.Workunit.Exceptions.ECLException", response)) {
                    lang.mixin(response.WUInfoResponse.Workunit, {
                        Exceptions: {
                            ECLException: []
                        }
                    })
                }
                context.updateData(response.WUInfoResponse.Workunit);

                if (args.onGetText) {
                    args.onGetText(lang.exists("Query.Text", context) ? context.Query.Text : "");
                }
                if (args.onGetWUExceptions) {
                    args.onGetWUExceptions(lang.exists("Exceptions.ECLException", context) ? context.Exceptions.ECLException : []);
                }
                if (args.onGetApplicationValues) {
                    args.onGetApplicationValues(lang.exists("ApplicationValues.ApplicationValue", context) ? context.ApplicationValues.ApplicationValue : []);
                }
                if (args.onGetDebugValues) {
                    args.onGetDebugValues(lang.exists("DebugValues.DebugValue", context) ? context.DebugValues.DebugValue : []);
                }
                if (args.onGetVariables) {
                    args.onGetVariables(lang.exists("variables", context) ? context.variables : []);
                }
                if (args.onGetResults) {
                    args.onGetResults(lang.exists("results", context) ? context.results : []);
                }
                if (args.onGetSequenceResults) {
                    args.onGetSequenceResults(lang.exists("sequenceResults", context) ? context.sequenceResults : []);
                }
                if (args.onGetSourceFiles) {
                    args.onGetSourceFiles(lang.exists("sourceFiles", context) ? context.sourceFiles : []);
                }
                if (args.onGetTimers) {
                    args.onGetTimers(lang.exists("timers", context) ? context.timers : []);
                }
                if (args.onGetResourceURLs && lang.exists("resourceURLs", context)) {
                    args.onGetResourceURLs(context.resourceURLs);
                }
                if (args.onGetGraphs && lang.exists("graphs", context)) {
                    if (context.timers || lang.exists("ApplicationValues.ApplicationValue", context)) {
                        for (var i = 0; i < context.graphs.length; ++i) {
                            if (context.timers) {
                                context.graphs[i].Time = 0;
                                for (var j = 0; j < context.timers.length; ++j) {
                                    if (context.timers[j].GraphName === context.graphs[i].Name && !context.timers[j].HasSubGraphId) {
                                        context.graphs[i].Time = context.timers[j].Seconds;
                                        break;
                                    }
                                }
                                context.graphs[i].Time = Math.round(context.graphs[i].Time * 1000) / 1000;
                            }
                            if (lang.exists("ApplicationValues.ApplicationValue", context)) {
                                var idx = context.getApplicationValueIndex("ESPWorkunit.js", context.graphs[i].Name + "_SVG");
                                if (idx >= 0) {
                                    context.graphs[i].svg = context.ApplicationValues.ApplicationValue[idx].Value;
                                }
                            }
                        }
                    }
                    args.onGetGraphs(context.graphs);
                } else if (args.onGetGraphs) {
                    args.onGetGraphs([]);
                }
                if (args.onGetWorkflows && lang.exists("Workflows.ECLWorkflow", context)) {
                    args.onGetWorkflows(context.Workflows.ECLWorkflow);
                }
                if (args.onAfterSend) {
                    args.onAfterSend(context);
                }
            }
            return response;
        });
    },
    getGraphIndex: function (name) {
        if (this.graphs) {
            for (var i = 0; i < this.graphs.length; ++i) {
                if (this.graphs[i].Name === name) {
                    return i;
                }
            }
        }
        return -1;
    },
    getGraphTimers: function (name) {
        var retVal = [];
        arrayUtil.forEach(this.timers, function (timer, idx) {
            if (timer.HasSubGraphId && timer.GraphName === name) {
                retVal.push(timer);
            }
        }, this);
        return retVal;
    },
    getApplicationValueIndex: function (application, name) {
        if (lang.exists("ApplicationValues.ApplicationValue", this)) {
            for (var i = 0; i < this.ApplicationValues.ApplicationValue.length; ++i) {
                if (this.ApplicationValues.ApplicationValue[i].Application === application && this.ApplicationValues.ApplicationValue[i].Name === name) {
                    return i;
                }
            }
        }
        return -1;
    },
    getThorLogStatus: function (ThorLogList) {
        return ThorLogList.ThorLogInfo.length > 0 ? true : false;
    },
    getState: function () {
        return this.State;
    },
    getStateIconClass: function () {
        return getStateIconClass(this.StateID, this.isComplete(), this.Archived);
    },
    getStateImageName: function () {
        return getStateImageName(this.StateID, this.isComplete(), this.Archived);
    },
    getStateImage: function () {
        return getStateImage(this.StateID, this.isComplete(), this.Archived);
    },
    getStateImageHTML: function () {
        return getStateImageHTML(this.StateID, this.isComplete(), this.Archived);
    },
    getProtectedImageName: function () {
        if (this.Protected) {
            return "locked.png";
        }
        return "unlocked.png";
    },
    getProtectedImage: function () {
        return Utility.getImageURL(this.getProtectedImageName());
    },
    getProtectedHTML: function () {
        return Utility.getImageHTML(this.getProtectedImageName());
    },
    fetchText: function (onFetchText) {
        var context = this;
        if (lang.exists("Query.Text", context)) {
            onFetchText(this.Query.Text);
            return;
        }

        this.getInfo({
            onGetText: onFetchText
        });
    },
    fetchXML: function (onFetchXML) {
        if (this.xml) {
            onFetchXML(this.xml);
            return;
        }

        this._assertHasWuid();
        var context = this;
        WsWorkunits.WUFile({
            request: {
                Wuid: this.Wuid,
                Type: "XML"
            },
            load: function (response) {
                context.xml = response;
                onFetchXML(response);
            }
        });
    },
    fetchResults: function (onFetchResults) {
        if (this.results && this.results.length) {
            onFetchResults(this.results);
            return;
        }

        this.getInfo({
            onGetResults: onFetchResults
        });
    },
    fetchNamedResults: function (resultNames, row, count) {
        var deferred = new Deferred();
        var context = this;
        this.fetchResults(function (results) {
            var resultContents = [];
            arrayUtil.forEach(resultNames, function (item, idx) {
                resultContents.push(context.namedResults[item].fetchContent(row, count));
            });
            all(resultContents).then(function (resultContents) {
                var results = [];
                arrayUtil.forEach(resultContents, function (item, idx) {
                    results[resultNames[idx]] = item;
                });
                deferred.resolve(results);
            });
        });
        return deferred.promise;
    },
    fetchAllNamedResults: function (row, count) {
        var deferred = new Deferred();
        var context = this;
        this.fetchResults(function (results) {
            var resultNames = [];
            arrayUtil.forEach(results, function (item, idx) {
                resultNames.push(item.Name);
            });
            context.fetchNamedResults(resultNames, row, count).then(function (response) {
                deferred.resolve(response);
            });
        });
        return deferred.promise;
    },
    fetchSequenceResults: function (onFetchSequenceResults) {
        if (this.sequenceResults && this.sequenceResults.length) {
            onFetchSequenceResults(this.sequenceResults);
            return;
        }

        this.getInfo({
            onGetSequenceResults: onFetchSequenceResults
        });
    },
    fetchSourceFiles: function (onFetchSourceFiles) {
        if (this.sourceFiles && this.sourceFiles.length) {
            onFetchSourceFiles(this.sourceFiles);
            return;
        }

        this.getInfo({
            onGetSourceFiles: onFetchSourceFiles
        });
    },
    fetchTimers: function (onFetchTimers) {
        if (this.timers && this.timers.length) {
            onFetchTimers(this.timers);
            return;
        }

        this.getInfo({
            onGetTimers: onFetchTimers
        });
    },
    fetchGraphs: function (onFetchGraphs) {
        if (this.graphs && this.graphs.length) {
            onFetchGraphs(this.graphs);
            return;
        }

        this.getInfo({
            onGetGraphs: onFetchGraphs
        });
    },
    fetchGraphXgmmlByName: function (name, subGraphId, onFetchGraphXgmml, force) {
        var idx = this.getGraphIndex(name);
        if (idx >= 0) {
            this.fetchGraphXgmml(idx, subGraphId, onFetchGraphXgmml, force);
        } else {
            topic.publish("hpcc/brToaster", {
                Severity: "Error",
                Source: "ESPWorkunit.fetchGraphXgmmlByName",
                Exceptions: [
                    { Message: this.i18n.FetchingXGMMLFailed }
                ]
            });
            onFetchGraphXgmml("", "");
        }
    },
    fetchGraphXgmml: function (idx, subGraphId, onFetchGraphXgmml, force) {
        if (!force && !subGraphId && this.graphs && this.graphs[idx] && this.graphs[idx].xgmml) {
            onFetchGraphXgmml(this.graphs[idx].xgmml, this.graphs[idx].svg);
            return;
        } else if (!force && subGraphId && this.subgraphs && this.subgraphs[idx + "." + subGraphId] && this.subgraphs[idx + "." + subGraphId].xgmml) {
            onFetchGraphXgmml(this.subgraphs[idx + "." + subGraphId].xgmml, this.subgraphs[idx + "." + subGraphId].svg);
            return;
        }

        this._assertHasWuid();
        var context = this;
        WsWorkunits.WUGetGraph({
            request: {
                Wuid: this.Wuid,
                GraphName: this.graphs[idx].Name,
                SubGraphId: subGraphId
            }
        }).then(function (response) {
            if (lang.exists("WUGetGraphResponse.Graphs.ECLGraphEx", response) && response.WUGetGraphResponse.Graphs.ECLGraphEx.length) {
                if (subGraphId) {
                    if (!context.subgraphs) {
                        context.subgraphs = {};
                    }
                    if (!context.subgraphs[idx + "." + subGraphId]) {
                        context.subgraphs[idx + "." + subGraphId] = {};
                    }
                    context.subgraphs[idx + "." + subGraphId].xgmml = "<graph>" + response.WUGetGraphResponse.Graphs.ECLGraphEx[0].Graph + "</graph>";
                    onFetchGraphXgmml(context.subgraphs[idx + "." + subGraphId].xgmml, context.subgraphs[idx + "." + subGraphId].svg);
                } else {
                    context.graphs[idx].xgmml = response.WUGetGraphResponse.Graphs.ECLGraphEx[0].Graph;
                    onFetchGraphXgmml(context.graphs[idx].xgmml, context.graphs[idx].svg);
                }
            } else {
                topic.publish("hpcc/brToaster", {
                    Severity: "Error",
                    Source: "ESPWorkunit.fetchGraphXgmml",
                    Exceptions: [
                        { Message: context.i18n.FetchingXGMMLFailed }
                    ]
                });
                onFetchGraphXgmml("", "");
            }
        });
    },
    setGraphSvg: function (graphName, svg) {
        var idx = this.getGraphIndex(graphName);
        if (idx >= 0) {
            this.graphs[idx].svg = svg;
            var appData = [];
            appData[graphName + "_SVG"] = svg;
            this.update({}, appData);
        }
    }
});


export function isInstanceOfWorkunit(obj) {
    return obj && obj.isInstanceOf && obj.isInstanceOf(Workunit);
}

export function Create(params) {
    var retVal = new Workunit(params);
    retVal.create();
    return retVal;
}

export function Get(wuid, data?) {
    var store = new Store();
    var retVal = store.get(wuid);
    if (data) {
        retVal.updateData(data);
    }
    return retVal;
}

export function CreateWUQueryStore(options) {
    var store = new Store(options);
    return Observable(store);
}
