"""
WHAT: Executes the code cells of every notebook in pymiss/notebooks (no Jupyter needed).
WHY:  The M11 notebooks once shipped with literal backslash-n text and a wrong sys.path and nobody noticed.
      Running them in the gate keeps the Python companion honest.
HOW:  For each .ipynb: chdir into pymiss/notebooks, exec the code cells in one namespace with stdout
      swallowed; IPython magics (lines starting with %) are skipped. Plotting is optional: a notebook that
      imports matplotlib is skipped when matplotlib is not installed.
LORE: C3 (tests and two languages)
"""
import contextlib
import io
import json
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
NB_DIR = os.path.join(HERE, '..', 'notebooks')


class NotebooksRun(unittest.TestCase):
    def test_every_notebook_runs(self):
        names = sorted(n for n in os.listdir(NB_DIR) if n.endswith('.ipynb'))
        self.assertGreaterEqual(len(names), 20)
        cwd = os.getcwd()
        try:
            os.chdir(NB_DIR)
            for name in names:
                with self.subTest(notebook=name):
                    with open(name) as fh:
                        nb = json.load(fh)
                    code = [''.join(c['source']) for c in nb['cells'] if c['cell_type'] == 'code']
                    joined = '\n'.join(code)
                    self.assertNotIn('\\n' + 'import', joined, 'literal backslash-n in source')
                    if 'matplotlib' in joined:
                        try:
                            import matplotlib  # noqa: F401
                            matplotlib.use('Agg')
                        except ImportError:
                            continue
                    g = {}
                    with contextlib.redirect_stdout(io.StringIO()):
                        for src in code:
                            src = '\n'.join(l for l in src.split('\n') if not l.strip().startswith('%'))
                            exec(compile(src, name, 'exec'), g)
        finally:
            os.chdir(cwd)


if __name__ == '__main__':
    unittest.main()
