var tags = [
    "a", "abbr", "address", "area", "article", "aside", "audio",
    "b", "base", "bdo", "blockquote", "body", "br", "button", "canvas",
    "caption", "cite", "code", "col", "colgroup", "command", "datalist",
    "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "embed",
    "eventsource", "fieldset", "figcaption", "figure", "footer", "form", "h1",
    "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
    "i", "iframe", "img", "input", "ins", "kbd", "keygen", "label", "legend",
    "li", "link", "mark", "html-map", "menu", "html-meta", "meta", "meter",
    "nav", "noscript", "object", "ol", "optgroup", "option", "output", "p",
    "param", "pre", "progress", "q", "ruby", "rp", "rt", "samp", "script",
    "section", "select", "small", "source", "span", "strong", "style", "sub",
    "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th",
    "thead", "html-time", "title", "tr", "ul", "video", "wbr"
],
$ = {},
tag;

(function () {
    function parseAttributes(options) {
        var attributes = [], option;
        for (option in options) {
            if (options.hasOwnProperty(option)) {
                attributes.push(option + 
                    (options[option] !== undefined ?
                        "=\"" + options[option] + "\"" : ""));
            }
        }
        return attributes;
    }

    function buildTag(el) {
        return function (/*options, content, ...*/) {
            var options = (typeof arguments[0] === "object" ? arguments[0] : undefined),
                attributes = (options ? parseAttributes(options) : []),
                inc = (options ? 1 : 0), lim,
                contents = [];

            for (lim = arguments.length; inc < lim; inc += 1) {
                contents.push(arguments[inc].toString());
            }
            return "<" + el +
                (attributes.length > 0 ? " " + attributes.join(" ") : "") +
                (contents.length >  0 ?
                    ">" + contents.join("") + "</" + el :
                    "/") +
                ">";
        };
    }

    /* not very optimized
    function buildMacro(func, options) {
        return function () {
            var inc, lim,
                attrs = {};
            for (inc = 0, lim = options.length; inc < lim; inc += 1) {
                attrs[options[inc]] = arguments[inc];
            }
            return func.apply($.,
                [attrs].concat(Array.prototype.slice.call(arguments, lim)));
        };
    }
    $["$.image"] = buildMacro($["$." + img], ["src"]);
    $["$.linkTo"] = buildMacro($["$." + a], ["href"]);
    */

    $["!DOCTYPE"] = function (/*options, html*/) {
        var options = (typeof arguments[0] === "object" ?
                arguments[0] : undefined),
            attributes,
            html = arguments[(options ? 1 : 0)] || "";

        if (options) {
            attributes = parseAttributes(arguments[0]);
        }
        return "<!DOCTYPE" +
            (attributes.length > 0 ? " " + attributes.join(" ") : "") +
            ">" + html;
    }

    for (tag in tags) {
        $[tags[tag]] = buildTag(tags[tag]);
    }

    $.image = function (src) {
        return $.img({src: src});
    };

    $.linkTo = function (href/*, content, ...*/) {
        return $.a.apply(this,
            [{href: href}].concat(Array.prototype.slice.call(arguments, 1)));
    };

    $.list = function (options, items) {
        return $.ul(options, (function () {
            var inc = 0, lim = items.length,
                content = [];
            return items.map(function (el) {
                return $.li.apply(this, items[inc]);
            }).join("");
        }()));
    };

    $.javascript = function (options, src) {
        return $.script(({type: "text/Javascript", src: src}).merge(options), "");
    }

    $.header = function (title) {
        return $.div({id: "header", "class": "header"},
            $.h1({style: "float:left"},
                title),
            $.list({id: "navbar", "class": "horizontal_list"}, [
                    [{id: "menu1"}, $.linkTo("/home", $.image("./images/item.png"), " Home")],
                    [{id: "menu2"}, $.linkTo("/pricing", $.image("./images/item.png"), " Pricing")],
                    [{id: "menu3"}, $.linkTo("/about", $.image("./images/item.png"), " About")],
                    [{id: "menu4"}, $.linkTo("/contact", $.image("./images/item.png"), " Contact")]
                ])
        );
    };

    $.standardHead = function (title/*, content, ...*/) {
        return $["!DOCTYPE"]({html:undefined},
            $.html.apply(this, [
                    {lang: "en", "class": "js"},
                    $.head(
                        $.meta({"http-equiv": "X-UA-Compatible", content: "IE=8;chrome=1"}),
                        $.meta({charset: "utf-8"}),
                        $.title(title),
                        $.link({type: "text/css", rel: "stylesheet", href: "/style.css"})/*,
                        $.link({rel: "shortcut icon", href: "favicon.png"}),
                        $.link({type: "text/css", rel: "stylesheet", media:"print", href: "css/print.css"})*/),
                ].concat(Array.prototype.slice.call(arguments, 1))));
    };
}());

exports.$ = $;