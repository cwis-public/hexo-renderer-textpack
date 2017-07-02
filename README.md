This module allows .textpack files to be loaded by Hexo as regular files, without requiring them to be expanded first.

Textpack files are ZIP files that contains a main text file (often in Markdown format) as well as any additional assets, such as images. 

Calls to the hexo-fs module from hexo are intercepted by this module, so that reading a textpack files returns its text content. Additionally, reading a textpack registers all the assets it contains, by using special URLs inside the textpack, such as:

	\_\_textpack-dynamic\_\_/_posts/example.textpack/assets/textbundle.png

When reading this asset, this module intercepts this file read operation, and returns the assets/textbundle.png file inside the \_posts/example.textpack textpack.
