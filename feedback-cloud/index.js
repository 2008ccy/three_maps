// Ordinary CloudBase event-function entry, exposed only through its HTTP gateway.
// No SDK initialization or cloud access occurs while configuration is unverified.
exports.main = async (event, context) => (await import('./src/runtime.mjs')).main(event, context);
