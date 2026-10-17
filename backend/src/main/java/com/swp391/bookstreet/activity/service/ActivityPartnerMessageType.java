package com.swp391.bookstreet.activity.service;

public enum ActivityPartnerMessageType {
    PROPOSAL_NEEDS_CHANGES("Your Activity proposal needs changes"),
    PROPOSAL_APPROVED("Your Activity proposal was approved"),
    PROPOSAL_REJECTED("Your Activity proposal was rejected"),
    PROPOSAL_CLOSED_BY_SYSTEM("Your Activity proposal was closed"),
    CHANGE_REQUEST_APPROVED("Your Activity change request was approved"),
    CHANGE_REQUEST_REJECTED("Your Activity change request was rejected"),
    CANCELLATION_REQUEST_APPROVED("Your Activity cancellation request was approved"),
    CANCELLATION_REQUEST_REJECTED("Your Activity cancellation request was rejected"),
    ACTIVITY_CANCELLED_BY_ORGANIZER("Your Activity was cancelled by the Organizer"),
    REQUEST_CLOSED_BY_SYSTEM("Your Activity request was closed");

    private final String summary;

    ActivityPartnerMessageType(String summary) {
        this.summary = summary;
    }

    public String summary() {
        return summary;
    }
}
