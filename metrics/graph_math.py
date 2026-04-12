class CyclomaticComplexity:
    """
    Mathematical engine for calculating codebase complexity using Graph Theory.
    Based on Thomas J. McCabe's cyclomatic complexity formulation: M = E - N + 2P
    """
    
    # Control flow nodes that create branching in execution paths
    BRANCH_TOKENS = [
        r'\bif\b', r'\belse if\b', r'\bfor\b', r'\bwhile\b', r'\bcase\b',
        r'\bcatch\b', r'\?\?', r'\?', r'&&', r'\|\|'
    ]

    @staticmethod
    def calculate_mccabe(source_code: str) -> int:
        """
        Calculates execution paths by identifying decision points in the syntax.
        Base complexity is 1 (straight-line execution).
        """
        import re
        
        complexity = 1
        # Strip string literals and comments to prevent false positives
        clean_code = re.sub(r'//.*|/\*[\s\S]*?\*/|".*?"|\'.*?\'|`[\s\S]*?`', '', source_code)
        
        for token in CyclomaticComplexity.BRANCH_TOKENS:
            matches = re.findall(token, clean_code)
            complexity += len(matches)
            
        return complexity