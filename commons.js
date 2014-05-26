require("./lib").loadLibrary([{
    "object": GLOBAL,
    "functions": [
        function loop(times, func) {
            var i, ret;

            if (times > 0) {
                for (i = times; i; i -= 1) {
                    ret = func(times - i);
                    if (ret !== undefined) {
                        return ret;
                    }
                }
                return ret;
            }
        },
        function skip1() {
            return Array.prototype.slice.call(arguments, 1);
        },
        function joinSlashes(arr) {
            return arr.join("/");
        },
        function writeResponse(res, type, text) {
            res.writeHead(200, {
                "Content-Type": type
            });
            res.end(text.constructor === Array ? text.join("\n") : text);
        },
        function writeHtmlResponse(res, html) {
            writeResponse(res, "text/HTML", html);
        },
        function writePlainResponse(res, text) {
            writeResponse(res, "text/Plain", text);
        },
        function outputList(list, callBack) {
            if (list && list.join) {
                callBack(list.join(", "));
            }
        }
    ]}
]);
