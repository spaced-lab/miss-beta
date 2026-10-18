import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import build_lore  # noqa: E402


class TestBuildLore(unittest.TestCase):
    def test_parses_every_topic_with_five_levels(self):
        with open(os.path.join(ROOT, "EDUCATION.md"), encoding="utf-8") as fh:
            topics, labs, errors = build_lore.parse(fh.read())
        self.assertEqual(len(topics), 56)
        self.assertEqual(len(labs), 20)
        self.assertEqual([e for e in errors if "em dash" in e], [])
        for t in topics:
            self.assertEqual(sorted(t["levels"].keys()), sorted(build_lore.LEVELS), t["id"])
            simple = build_lore.level_record(t, "SIMPLE")
            self.assertTrue(simple["pictureId"].startswith("pic-"), t["id"])
            self.assertLessEqual(len(simple["markdown"].split()), 20, t["id"])
            ex = build_lore.level_record(t, "EXPERT")
            self.assertTrue(ex["demoId"] is None or ex["demoId"] in labs, t["id"])

    def test_validation_catches_contract_breaks(self):
        text = "## T1 One\nmeta: related=[T9]  game=[x]  tags=[a]\n### SIMPLE\nPICTURE: pic-nope  d\nTEXT: " + "w " * 25 + "\n### BEGINNER\nb\n### INTERMEDIATE\ni\n### ADVANCED\na\n### EXPERT\nDEMO: LAB_NOPE\n"
        topics, labs, errors = build_lore.parse(text)
        build_lore.validate(topics, labs, errors)
        joined = "\n".join(errors)
        self.assertIn("related T9", joined)
        self.assertIn("SIMPLE TEXT has 25 words", joined)
        self.assertIn("DEMO LAB_NOPE", joined)
        self.assertIn("pic-nope", joined)
        t2 = "## T1 One\nmeta: related=[]  game=[]  tags=[]\n### SIMPLE\nPICTURE: pic-x  d\nTEXT: ok\n### BEGINNER\nb\n"
        topics, labs, errors = build_lore.parse(t2)
        build_lore.validate(topics, labs, errors)
        self.assertTrue(any("missing level EXPERT" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
