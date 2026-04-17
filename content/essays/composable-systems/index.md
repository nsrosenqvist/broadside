+++
title = "Composable systems and the death of the monolith"
date = 2026-03-27
description = "Why the boundaries you draw matter more than the code you write"

[taxonomies]
categories = ["Architecture"]

[extra]
subtitle = "Why the boundaries you draw matter more than the code you write"
author = "Elena Larsson"
+++

The monolith is not dead because microservices won. The monolith is dead because we learned, painfully and slowly, that the most important architectural decision is not how you structure your code — it is where you draw the boundaries.

A well-bounded monolith is better than a poorly-bounded set of microservices. The conversation was never really about deployment topology. It was about cohesion, coupling, and the ability to change one thing without breaking everything else.

## Boundaries as design decisions

The boundary between two systems is not a technical artifact. It is a design decision with organizational implications. Conway's Law is not a curiosity — it is a fundamental constraint.

When you draw a boundary, you are deciding:

- Who can change what independently
- Where failures will be contained
- How data flows through your organization
- Which teams need to coordinate and which can move alone

These are not engineering decisions. They are organizational decisions expressed in code.

## The composable alternative

Composable systems take a different approach. Instead of asking "how do we split this monolith?" they ask "what are the natural seams?"

Natural seams exist where:

1. **Data ownership is clear.** One team owns this data and its lifecycle.
2. **Change frequency differs.** This part changes weekly; that part changes yearly.
3. **Failure domains are distinct.** A failure here should not cascade there.

The result is not microservices. It is not a monolith. It is a system whose boundaries reflect reality rather than ideology.
