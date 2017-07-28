# hexo-renderer-textpack

This module allows .textpack files and .textsbundle directories to be loaded by Hexo as regular files.

Textpack files are ZIP files that contains a main text file (often in Markdown format) as well as any additional assets, such as images. 
Textbundles files are directories that contain asssets within an `assets` sub-directory, and can be edited with many editors.

## How to use

No setup is required. Once this module is installed, Hexo will render textpack files and textbundle directories, as well as the images or any other assets that they contain.

## Under the hood

Calls to the hexo-fs module from hexo are intercepted by this module, so that reading a textpack files returns its text content. Additionally, reading a textpack registers all the assets it contains, by using special URLs inside the textpack, such as:

	-textpack-dynamic-/_posts/example.textpack/assets/textbundle.png

When reading this asset, this module intercepts this file read operation, and returns the assets/textbundle.png file inside the \_posts/example.textpack textpack.

The same trick is being used on textbundle files, so that their assets are relocated to a virtual URL, such as:

	-textbundle-dynamic-/_posts/example.textbundle/textbundle.png


