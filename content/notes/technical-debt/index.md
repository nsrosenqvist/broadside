+++
title = "The economics of technical debt"
date = 2026-03-20
description = "A framework for deciding when to pay it down and when to let it ride"

[taxonomies]
categories = ["Engineering"]

[extra]
subtitle = "A framework for deciding when to pay it down and when to let it ride"
author = "Marcus Chen"
+++

Technical debt is the most overused metaphor in software engineering, and also the most useful. The problem is not the metaphor itself — it is that most teams use it imprecisely, treating all debt as equal and all repayment as virtuous.

Not all debt is created equal. Some debt is a mortgage — a deliberate, well-understood trade-off that enables growth. Some is credit card debt — accumulated carelessly, with compounding interest that will eventually become unmanageable.

## A taxonomy of debt

Understanding what kind of debt you hold is the first step toward managing it well.

**Strategic debt** is taken on deliberately. You know the code is not ideal, but shipping now creates value that exceeds the future cost of cleanup. This is the mortgage.

**Accidental debt** accumulates through ignorance or haste. No one decided to take it on. It just happened, decision by decision, shortcut by shortcut. This is the credit card.

**Environmental debt** emerges from external changes. The code was fine when it was written, but the world moved. Dependencies evolved, requirements shifted, best practices changed. This is inflation.

> "The question is never whether you have technical debt. The question is whether you know what kind you have and what it's costing you."

## When to pay and when to hold

The decision to address technical debt is an economic one, not a moral one. Framing it morally — "we *should* clean this up" — leads to unfocused refactoring that delivers no measurable value.

Instead, ask: what is this debt costing us in velocity, reliability, or cognitive load? And is that cost greater than the cost of repayment?

If the answer is no, the debt is not worth paying down right now. That is a legitimate decision, not a failure of engineering discipline.
