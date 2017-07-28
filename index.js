/* global hexo */

"use strict;";

var rendererTextpack = require("./lib/renderer-textpack.js").get(hexo),
	rendererTBText = require("./lib/renderer-tbtext.js").get(hexo),
	file = require("./lib/file.js");

file.initialize(hexo);

hexo.extend.renderer.register('textpack', 'html', rendererTextpack, true);
hexo.extend.renderer.register('tbtext', 'html', rendererTBText, true);
