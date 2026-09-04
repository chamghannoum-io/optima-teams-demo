package com.i3hub.optima.domain;

/**
 * Work item types for queue management
 */
public enum WorkItemType {
    RECONCILIATION,
    CLAIM_SUBMISSION,
    CLAIM_RESUBMISSION,
    CLAIM_VALIDATION,
    AUTHORIZATION_SUBMISSION,
    AUTHORIZATION_RESUBMISSION
}