# TextPack project pages

The public Chinese page is <https://sleppyme.github.io/marktext-textpack/>;
the English page is <https://sleppyme.github.io/marktext-textpack/en/>.

Edit the copy and HTML template in `scripts/build-textpack-site.mjs`, the shared
stylesheet in this directory, and product assets under `assets/`. Build with:

```sh
node scripts/build-textpack-site.mjs
```

The build writes static HTML, assets and a sitemap to `dist/textpack-site` without
installing packages. Content and navigation remain available without JavaScript.
`textpack-pages.yml` publishes changes from `textpack` through GitHub Pages.

The screenshot and editable sample are product assets. To refresh them, run
`Verify and capture TextPack demo` manually and retrieve its product-demo artifact.
That workflow downloads and checksums the published Windows ZIP, opens the sample,
edits it and invokes the production renderer Save action, reopens it with a new
profile, verifies its image, and captures the actual editor. Renderer-only CDP
input does not verify the native menu shortcut. Keep the caption consistent with
the release used for capture.

The site describes compressed TextPack support only. Directory-form TextBundle
and outer-folder ZIP layouts remain outside the current scope. Keep the README,
public FAQ and application-list submissions consistent with those limits.
