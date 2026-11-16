# TextBundle and TextPack documents

MarkText edits directory documents (`.textbundle`) and compressed documents (`.textpack`). A TextBundle keeps its Markdown and assets directly accessible on disk. A TextPack stores the same contents in one ZIP-based file for exchange.

## TextBundle

- On Windows, right-click a `.textbundle` directory and choose **Open with MarkText** after installing MarkText. Double-click the directory to browse its contents. On Windows 11, the command is in the classic menu under **Show more options**.
- In MarkText, select a bundle with **File → Open Folder**, drag it onto the tab bar, or open the parent directory and select the bundle in the sidebar. Quick Open and folder search show the bundle as one document. Opening its root Markdown body in MarkText selects the same document.
- In the first **Save** dialog, select **TextBundle (folder)** and enter a name in the parent directory. **Settings → Files → Default save format for new documents** starts at **Markdown** and can be set to **TextBundle**. **Save As** starts with the current document's format.
- **Save** updates the document in place. Newly pasted or dropped local images join the bundle's `assets/` when the edit is saved. Closing and discarding the edit discards the pending images as well.
- Use **Save As** to convert an open document between TextBundle and TextPack and continue editing the new copy. Use **File → Export → Export as TextPack** for a shareable snapshot of the current text and assets while you continue editing the original. Package conversions preserve other files and metadata, including assets the Markdown does not currently reference.

## TextPack

- Open a `.textpack` from **File → Open**, the recent-files menu, the command line, a file association, or by dropping it on MarkText.
- Edit it like any other Markdown document. Relative `assets/...` images resolve inside the bundle.
- Pasted or dropped images are copied into the bundle's `assets/` directory. The Markdown keeps a portable POSIX-style `assets/...` reference.
- **Save** rebuilds and validates a temporary archive, then replaces the original. External changes enter MarkText's existing file-change flow; a final source-revision check also prevents a changed archive from being overwritten during a race.
- If the original was deleted, **Save** (including auto-save) reports the missing file. **Save As** can recreate it at the same location and name, or save to a different path, using the current text and complete cached package. Existing destinations require the save dialog's overwrite confirmation. A destination change detected during packing cancels the replacement.
- Missing cached package files cancel saving rather than silently producing an incomplete archive. The workspace inventory preserves metadata, attachments, and unreferenced files as well as images.
- Saving a Markdown or untitled document as `.textpack` embeds Base64 image data, local absolute/file-URL images, and relative local link/image targets. Inline images, reference-style images, and HTML `<img src>` are supported. Source files are copied, never moved. Missing or invalid resources cancel conversion without replacing the destination.
- Saving a TextPack as Markdown exports its complete `assets/` directory as `<document>.assets` and rewrites Markdown destinations accordingly.

## Compatibility and safety

MarkText accepts TextBundle versions 1 and 2 with a Markdown type (or no type), a lowercase root `info.json`, and exactly one root `text.*`. It preserves unknown metadata, unknown files, and unreferenced assets when saving back to TextPack. Text is decoded as strict UTF-8; a UTF-8 BOM is accepted.

Archives containing traversal/absolute paths, backslashes, platform device names, duplicate case-folded names, symbolic links, encrypted entries, excessive entry counts/sizes, or suspicious compression ratios are rejected before a tab opens.

## Current preview limitations

- The ZIP must place `info.json` and `text.*` directly at its root. Archives
  containing an enclosing `.textbundle` folder are currently rejected, including
  the wrapped-layout TextPack example distributed by TextBundle.org.
- Relative resources in an untitled document have no known source directory. Save the Markdown beside its resources first; TextPack conversion deliberately does not guess a directory. Base64, absolute paths, and file URLs do not need a source directory.
- HTTP/HTTPS and protocol-relative images remain remote links. The conversion implementation has an internal `remoteImages: 'preserve' | 'embed'` option, defaulting to `preserve`. `embed` is reserved and explicitly fails as unimplemented. No MarkText preference, settings UI, or package metadata field is added.
- The source-position scanner is not a full CommonMark parser. Complex nested block syntax and HTML `srcset`/CSS images are not currently supported. Embedded image data must use a supported Base64 image MIME type; invalid or unsupported image data fails conversion explicitly.
- TextPack does not add a generic non-image attachment insertion UI. Non-image drag-and-drop keeps MarkText's existing behavior, while arbitrary files already stored under `assets/` are preserved and relative local files referenced by Markdown links are collected during conversion.
- Recovery reuses resource workspaces left by an abnormal exit, together with MarkText's existing buffered Markdown recovery. There is not yet a dedicated recovery-candidate picker.
- External changes use the existing MarkText reload notification. MarkText stages the changed archive without disturbing local resources and switches the Markdown and complete resource workspace together only when the existing reload flow accepts the external version.
