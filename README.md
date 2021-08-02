# Website helpers

## Post Generation

On --build, or on --watch, any changes made to the md/ folder will be converted to html for the end user file.

Any new .md files will create new .html files in /posts, cloned from the post.template.html file.

Any changes to post.template.html will be replicated across all posts.

## CSS tools

On --build or --watch, a CSS extenstion will process the css source file. The extension allows you to use SCSS like syntax. I'm only using it for nesting.
