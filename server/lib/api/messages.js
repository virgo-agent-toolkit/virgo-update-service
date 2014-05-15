var util = require('util');


/**
 * The base RPC Message.
 * @constructor
 **/
function Message() {
  this.success = null;
  this.error = null;
}


function Response(values)
{
  Response.super_.call(this);
  this.success = true;
  this.values = values;
}
util.inherits(Response, Message);


function ErrorResponse(err)
{
  ErrorResponse.super_.call(this);
  this.error = true;
  this.values = { message: err.message };
}
util.inherits(ErrorResponse, Message);


exports.Response = Response;
exports.ErrorResponse = ErrorResponse;
