// UA stylesheets — mirrors weasyprint/css/html5_ua.css (+ form + ph).
// This is the user-agent base applied before author styles.

export const UA_STYLESHEET = `
html { display: block; }
head, link, meta, script, style, title { display: none; }
body { display: block; margin: 8px; }
p, div, section, article, header, footer, main, nav, aside,
h1, h2, h3, h4, h5, h6, ul, ol, dl, dd, pre, blockquote, figure, hr { display: block; }
h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
h2 { font-size: 1.5em; font-weight: bold; margin: 0.83em 0; }
h3 { font-size: 1.17em; font-weight: bold; margin: 1em 0; }
h4 { font-weight: bold; margin: 1.33em 0; }
h5 { font-size: 0.83em; font-weight: bold; margin: 1.67em 0; }
h6 { font-size: 0.67em; font-weight: bold; margin: 2.33em 0; }
p { margin: 1em 0; }
ul, ol { margin: 1em 0; padding-left: 40px; }
li { display: list-item; }
a { color: #0000EE; text-decoration: underline; }
b, strong { font-weight: bold; }
i, em { font-style: italic; }
pre { white-space: pre; font-family: monospace; margin: 1em 0; }
code { font-family: monospace; }
blockquote { margin: 1em 40px; }
hr { border-top-width: 1px; border-top-style: solid; margin: 0.5em auto; }
table { display: table; border-spacing: 2px; }
tr { display: table-row; }
td, th { display: table-cell; padding: 1px; }
th { font-weight: bold; text-align: center; }
thead { display: table-header-group; }
tbody { display: table-row-group; }
img { display: inline-block; }
span { display: inline; }
br::before { content: "\\A"; white-space: pre-line; }
ol, ul { list-style: disc outside; }
ol { list-style-type: decimal; }
table { border-collapse: separate; }
sup, sub { font-size: smaller; }
small { font-size: smaller; }
`;

export const UA_FORM_STYLESHEET = `
input, button, select, textarea { display: inline-block; font-family: sans-serif; }
`;

export const PH_STYLESHEET = `
[hidden] { display: none; }
`;

export const UA_COUNTER_STYLE = `
@counter-style decimal { system: numeric; symbols: "0" "1" "2" "3" "4" "5" "6" "7" "8" "9"; }
`;
