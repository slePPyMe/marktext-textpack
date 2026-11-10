import argparse
import base64
import hashlib
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'textpack-artifacts.py'
SPEC = importlib.util.spec_from_file_location('textpack_artifacts', SCRIPT)
artifacts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(artifacts)


class TextPackArtifactTests(unittest.TestCase):
    def test_package_matrix_matches_upstream_stable_formats(self):
        all_names = []
        for platform in ['windows', 'macos', 'linux']:
            for arch in ['x64', 'arm64']:
                all_names.extend(artifacts.platform_files(platform, arch, '0.23.0'))
        self.assertEqual(len(all_names), 23)
        self.assertEqual(len(set(all_names)), 23)
        self.assertIn('marktext-textpack-linux-0.23.0.snap', all_names)
        self.assertNotIn('marktext-textpack-linux-arm64-0.23.0.snap', all_names)

    def test_reusing_a_merged_manifest_retains_only_its_architecture(self):
        files = [
            {'url': f'package-{arch}.exe', 'sha512': arch, 'size': 1}
            for arch in ['x64', 'arm64']
        ]
        document = {'version': '0.23.0', 'files': files, 'path': files[0]['url'], 'sha512': 'x64'}
        result = artifacts.narrow_manifest(document, ['package-arm64.exe'], '0.23.0')
        self.assertEqual(result['files'], [files[1]])
        self.assertEqual(result['path'], 'package-arm64.exe')
        self.assertEqual(result['sha512'], 'arm64')
        self.assertEqual(len(document['files']), 2)
        with self.assertRaisesRegex(ValueError, 'different version'):
            artifacts.narrow_manifest(document, ['package-arm64.exe'], '0.24.0')

    def test_metadata_verification_rejects_truncated_or_changed_downloads(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            package = directory / 'package.exe'
            package.write_bytes(b'original package')
            metadata = directory / 'latest.yml'
            metadata.write_text(artifacts.yaml.safe_dump({
                'version': '0.23.0',
                'files': [{
                    'url': package.name,
                    'size': package.stat().st_size,
                    'sha512': base64.b64encode(hashlib.sha512(package.read_bytes()).digest()).decode(),
                }],
            }))
            artifacts.verify_manifest(metadata, directory, '0.23.0')
            package.write_bytes(b'changed! package')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                artifacts.verify_manifest(metadata, directory, '0.23.0')
            package.write_bytes(b'short')
            with self.assertRaisesRegex(ValueError, 'truncated'):
                artifacts.verify_manifest(metadata, directory, '0.23.0')

    def test_published_binary_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            (directory / 'package.exe').write_bytes(b'changed bytes')
            release = {
                'draft': False,
                'immutable': False,
                'assets': [{'name': 'package.exe', 'digest': 'sha256:original'}],
            }
            args = argparse.Namespace(
                version='0.23.0', tag='textpack-v0.23.0', directory=directory,
                complete_existing=True, publish=True, notes=directory / 'notes.md',
            )
            with patch.object(artifacts, 'github', return_value=release), patch.object(artifacts.subprocess, 'run') as run:
                with self.assertRaisesRegex(ValueError, 'refusing to overwrite'):
                    artifacts.publish(args)
                run.assert_not_called()

    def test_published_release_requires_explicit_completion(self):
        args = argparse.Namespace(version='0.23.0', tag='textpack-v0.23.0', complete_existing=False)
        with patch.object(artifacts, 'github', return_value={'draft': False}):
            with self.assertRaisesRegex(ValueError, 'explicit'):
                artifacts.publish(args)


if __name__ == '__main__':
    unittest.main()
