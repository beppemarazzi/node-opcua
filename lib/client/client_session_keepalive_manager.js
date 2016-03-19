require("requirish")._(module);
var assert = require("better-assert");
var EventEmitter = require("events").EventEmitter;
var util = require("util");

var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
var VariableIds = require("lib/opcua_node_ids").VariableIds;

var serverStatus_State_Id = coerceNodeId(VariableIds.Server_ServerStatus_State);
var ServerState = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServerState_enum").ServerState;

function ClientSessionKeepAliveManager(session) {
    var self = this;
    self.session = session;
    self.timerId = 0;
}
util.inherits(ClientSessionKeepAliveManager, EventEmitter);
/**
 * @method ping_server
 *
 * when a session is opened on a server, the client shall send request on a regular basis otherwise the server
 * session object might time out.
 * start_ping make sure that ping_server is called on a regular basis to prevent session to timeout.
 *
 * @param callback
 */
ClientSessionKeepAliveManager.prototype.ping_server = function(callback) {
    var self = this;
    callback = callback || function () { };
    var the_session = this.session;
    if (!the_session) {
        return callback();
    }

    var nodes = [serverStatus_State_Id]; // Server_ServerStatus_State
    the_session.readVariableValue(nodes, function (err, dataValues) {
        if (err) {
            console.log(" warning : ".cyan, err.message.yellow);
            self.stop();
            /**
             * @event failure
             * raised when the server is not responding or is responding with en error to
             * the keep alive read Variable value transaction
             */
            self.emit("failure");
        } else {
            var newState = ServerState.get(dataValues[0].value.value);
            
            //istanbul ignore next
            if (newState !== self.lastKnownState) {
                // console.log(" Server State = ", newState.toString());
            }
            
            self.lastKnownState = newState;

            self.emit("keepalive",self.lastKnownState);
        }
        callback();
    });
};


ClientSessionKeepAliveManager.prototype.start = function() {
    var self = this;
    assert(!self.timerId);
    assert(self.session.timeout > 100);
    var pingTimeout = self.session.timeout * 2/3;

    self.timerId = setInterval(self.ping_server.bind(self), pingTimeout / 3);
};

ClientSessionKeepAliveManager.prototype.stop = function() {
    var self = this;
    if (self.timerId) {
        clearInterval(self.timerId);
        self.timerId = 0;
    }
};

exports.ClientSessionKeepAliveManager = ClientSessionKeepAliveManager;