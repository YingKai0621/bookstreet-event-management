package com.swp391.bookstreet.chat.service;

record ChatClassification(Kind intent, ChatIntentResolver.Timeframe timeframe,
        boolean availableOnly) {
    enum Kind { EVENT, ACTIVITY, BOTH, ACCOUNT, EVENT_HELP, ACTIVITY_HELP,
        ATTENDANCE, CERTIFICATE, BOOTH, NOTIFICATION, PERSONAL_EVENT,
        PERSONAL_ACTIVITY, UNKNOWN }

    static ChatClassification unknown() {
        return new ChatClassification(Kind.UNKNOWN, ChatIntentResolver.Timeframe.NONE, false);
    }
}
