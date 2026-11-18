#!/usr/bin/env python3
"""
Ollastar Generator CLI
Command-line interface to run Python ad generators (china.py, cola.py, etc.)
"""

import os
import sys
import subprocess

CUR_DIR = os.path.dirname(os.path.abspath(__file__))
GEN_DIR = os.path.join(CUR_DIR, "generators")

def list_generators():
    print("Available Python generators in render-service/generators:")
    for f in os.listdir(GEN_DIR):
        if f.endswith(".py") and f != "__init__.py":
            print(f"  • {f}")

def run_generator(script_name: str):
    if not script_name.endswith(".py"):
        script_name += ".py"
    target = os.path.join(GEN_DIR, script_name)
    if not os.path.exists(target):
        # Check current dir
        if os.path.exists(script_name):
            target = script_name
        else:
            print(f"Error: Generator '{script_name}' not found.")
            sys.exit(1)
            
    print(f"Running generator: {target}")
    res = subprocess.run([sys.executable, target], cwd=GEN_DIR)
    sys.exit(res.returncode)

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "help"):
        print("Usage: python generator_cli.py [list | run <generator.py>]")
        sys.exit(0)
        
    cmd = sys.argv[1]
    if cmd == "list":
        list_generators()
    elif cmd == "run" and len(sys.argv) > 2:
        run_generator(sys.argv[2])
    else:
        # Direct script name passed
        run_generator(cmd)
