/* global hexo */

"use strict;";

var renderer = require("./lib/renderer.js").get(hexo);
var file = require("./lib/file.js");

file.initialize();

hexo.extend.renderer.register('textpack', 'html', renderer, true);
