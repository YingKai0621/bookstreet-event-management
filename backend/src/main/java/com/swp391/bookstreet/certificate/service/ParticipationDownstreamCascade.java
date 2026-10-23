package com.swp391.bookstreet.certificate.service;

/**
 * Internal Sprint 6 boundary used by completion and audited Attendance correction flows.
 * Callers that also mutate an Event or Activity must acquire those upstream locks before invoking
 * this boundary. The transition key must identify the outer business transition, not message text.
 */
public interface ParticipationDownstreamCascade {
    ParticipationDownstreamResult issueOrRestore(ParticipationDownstreamCommand command);

    ParticipationDownstreamResult revokeAndInvalidate(ParticipationDownstreamCommand command);
}
