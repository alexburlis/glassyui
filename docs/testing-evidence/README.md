# Testing evidence

A blog post may show "Personally tested" only when this folder holds Alex's own
notes from a hands-on test of what the article describes, in
`docs/testing-evidence/<slug>.md`, and the post's `testing` frontmatter points
at that file (see `docs/blog-authoring.md`). No post has one yet.

Each file records, in Alex's words:

- the date of the test, which is the post's `testing.testedOn`;
- the device, operating system, browser and package or app versions, which the
  post's `testing.environment` summarises;
- what Alex did, step by step;
- what Alex saw, including anything that failed;
- screenshots or recordings, stored beside the file or linked from it.

Only Alex writes these files. Agents and writing workflows never create one,
copy one from another post, or turn automated checks into one.
