"""Native premultiplied pages must preserve transparency without a split alpha texture."""
import sys
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools/local-extract'))
from extract import merge_alpha, material_alpha_ref


class NativeAlphaTests(unittest.TestCase):
    def test_disabled_secondary_texture_does_not_replace_embedded_alpha(self):
        ref = {'m_FileID': 0, 'm_PathID': 123}
        material = {'m_SavedProperties': {'m_Floats': [('_UseAlphaTex', 0)],
                    'm_TexEnvs': [('_AlphaTex', {'m_Texture': ref})]}}
        self.assertIsNone(material_alpha_ref(material))
        material['m_ValidKeywords'] = ['_USEALPHATEX_ON']
        with self.assertRaisesRegex(ValueError, 'keyword disagrees'):
            material_alpha_ref(material)
        material['m_ValidKeywords'] = []
        material['m_SavedProperties']['m_Floats'] = [('_UseAlphaTex', 1)]
        self.assertEqual(material_alpha_ref(material), ref)
        material['m_SavedProperties']['m_TexEnvs'] = []
        with self.assertRaisesRegex(ValueError, 'missing'):
            material_alpha_ref(material)

    def test_embedded_alpha_and_compression_bleed(self):
        page = Image.new('RGBA', (3, 1))
        page.putdata([(23, 11, 7, 0), (120, 30, 20, 60), (5, 6, 7, 255)])
        self.assertEqual(list(merge_alpha(page, None).getdata()),
                         [(0, 0, 0, 0), (60, 30, 20, 60), (5, 6, 7, 255)])

    def test_split_alpha_replaces_main_channel(self):
        page = Image.new('RGBA', (2, 1), (100, 40, 20, 0))
        alpha = Image.new('L', (2, 1))
        alpha.putdata([50, 200])
        self.assertEqual(list(merge_alpha(page, alpha).getdata()),
                         [(50, 40, 20, 50), (100, 40, 20, 200)])

    def test_rgb_without_alpha_remains_opaque(self):
        self.assertEqual(merge_alpha(Image.new('RGB', (1, 1), (3, 4, 5)), None).getpixel((0, 0)),
                         (3, 4, 5, 255))


if __name__ == '__main__':
    unittest.main()
