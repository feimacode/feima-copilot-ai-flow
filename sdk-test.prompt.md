---
name: SDK Delegation Test
description: Minimal test for SDK delegation
orchestration: all-respond
useCli: true
roles:
  - name: Code Analyzer
    systemPrompt: |
      You are a code analyzer. Review the code for quality and suggest 2 improvements.
      Be concise.
    model: claude-sonnet-4.5
    
  - name: Security Reviewer
    systemPrompt: |
      You are a security reviewer. Check for security issues and suggest 1 fix.
      Be brief.
    model: claude-sonnet-4.5
---

Review the code focusing on implementation quality and security.
