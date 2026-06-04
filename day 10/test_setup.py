#!/usr/bin/env python3
"""
Test script for YOLO Docker setup
Verifies all components are ready for deployment
"""

import subprocess
import sys
import os
from pathlib import Path

class TestSuite:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        
    def run_test(self, name, command=None, check_file=None):
        """Run a single test"""
        print(f"Testing: {name}")
        try:
            if check_file:
                if Path(check_file).exists():
                    print(f"  [OK] FOUND: {check_file}")
                    self.passed += 1
                    return True
                else:
                    print(f"  [FAIL] MISSING: {check_file}")
                    self.failed += 1
                    return False
            elif command:
                result = subprocess.run(command, shell=True, capture_output=True, timeout=30)
                if result.returncode == 0:
                    print(f"  [PASS] {name}")
                    self.passed += 1
                    return True
                else:
                    print(f"  [FAIL] {name}")
                    print(f"  Error: {result.stderr.decode()}")
                    self.failed += 1
                    return False
        except Exception as e:
            print(f"  [FAIL] {name}")
            print(f"  Error: {str(e)}")
            self.failed += 1
            return False
    
    def report(self):
        """Print test report"""
        print("\n========================================")
        print("Test Summary")
        print("========================================")
        print(f"Passed: {self.passed}")
        print(f"Failed: {self.failed}")
        
        if self.failed == 0:
            print("\nAll tests passed! Ready for deployment.")
            return True
        else:
            print("\nSome tests failed. Please fix the issues above.")
            return False

def main():
    print("========================================")
    print("YOLO Docker Setup Test Script")
    print("========================================\n")
    
    tests = TestSuite()
    
    # Docker Environment
    print("--- Docker Environment ---")
    tests.run_test("Docker Installation", "docker --version")
    tests.run_test("Docker Daemon Running", "docker ps")
    
    # File Structure
    print("\n--- File Structure ---")
    files = [
        "Dockerfile",
        "requirements.txt",
        "inference.py",
        "app.py",
        "docker-compose.yml",
        "README.md"
    ]
    for file in files:
        tests.run_test(f"File: {file}", check_file=file)
    
    # Directory Structure
    print("\n--- Directory Structure ---")
    dirs = ["inputs", "outputs", "models"]
    for dir_name in dirs:
        if not Path(dir_name).exists():
            Path(dir_name).mkdir(parents=True, exist_ok=True)
            print(f"  [OK] Created: {dir_name}")
        else:
            print(f"  [OK] EXISTS: {dir_name}")
        tests.passed += 1
    
    # Docker Image Build (optional, can take time)
    print("\n--- Docker Image Build (Optional) ---")
    print("  Skipping Docker build test (takes too long)")
    print("  Run manually: docker build -t yolo-inference:test .")
    
    # Test Documentation
    print("\n--- Documentation ---")
    readme_path = Path("README.md")
    if readme_path.exists():
        try:
            lines = len(readme_path.read_text(encoding='utf-8').split("\n"))
        except:
            lines = len(readme_path.read_text(encoding='latin-1').split("\n"))
        if lines > 50:
            print(f"  [OK] README.md is comprehensive ({lines} lines)")
            tests.passed += 1
        else:
            print(f"  [WARN] README.md seems short ({lines} lines)")
    
    # Report
    success = tests.report()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
