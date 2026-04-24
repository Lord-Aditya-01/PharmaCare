function notFound(req,res,next) { res.status(404); next(new Error(`Not found: ${req.originalUrl}`)); }
function errorHandler(err,req,res,next) {
  const code = res.statusCode && res.statusCode!==200 ? res.statusCode : 500;
  res.status(code).json({ message:err.message||'Internal Server Error', ...(err.details?{details:err.details}:{}), ...(process.env.NODE_ENV!=='production'?{stack:err.stack}:{}) });
}
module.exports = { notFound, errorHandler };
