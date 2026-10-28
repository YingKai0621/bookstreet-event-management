package com.swp391.bookstreet.chat.service;

import java.text.Normalizer;
import java.util.Locale;

/** Bounded, deterministic routing for common Guest and Participant questions. */
final class ChatIntentResolver {
    enum Target { NONE, EVENT, ACTIVITY, BOTH }
    enum Timeframe { NONE, TODAY, TOMORROW, THIS_WEEK, NEXT_WEEK,
        THIS_WEEKEND, NEXT_WEEKEND, SATURDAY, SUNDAY }

    record Intent(Target target, Timeframe timeframe, boolean availability, boolean fullOnly,
            boolean personal, boolean howTo, boolean discovery, String query) {
    }

    private ChatIntentResolver() {
    }

    static Intent resolve(String query) {
        String q = normalize(query);
        boolean event = has(q, "su kien", "event", "hoi sach", "hoi cho sach",
                "ngay hoi", "le hoi", "chuong trinh", "lich su kien");
        boolean activity = has(q, "hoat dong", "activity", "workshop", "talkshow",
                "giao luu", "toa dam", "gap tac gia", "buoi noi chuyen", "buoi doc sach",
                "lop hoc", "buoi hoc", "trai nghiem");
        Timeframe timeframe = timeframe(q);
        boolean generic = has(q, "co gi vui", "co gi hay", "co gi dien ra",
                "co gi choi", "lich trinh", "lich sap toi", "di dau choi")
                || timeframe != Timeframe.NONE && has(q, "co gi", "lich", "di dau");
        boolean availability = has(q, "con cho", "cho trong", "con suat", "con ve");
        boolean seatCountQuestion = has(q, "bao nhieu cho", "bao nhieu suat", "may cho");
        boolean fullOnly = has(q, "het cho", "kin cho", "full slot", "da day",
                "day chua");
        boolean capacityQuestion = availability || fullOnly || seatCountQuestion;
        Target target = event && activity ? Target.BOTH
                : event ? Target.EVENT : activity ? Target.ACTIVITY
                : generic ? Target.BOTH : capacityQuestion ? Target.ACTIVITY : Target.NONE;
        if (availability || seatCountQuestion) target = Target.ACTIVITY;
        boolean howTo = has(q, "lam sao", "huong dan", "cach", "the nao",
                "vi sao", "tai sao", "co can", "khac gi", "phan biet",
                "co duoc", "khong can");
        boolean ownership = has(q, "cua toi", "cua minh", "toi da dang ky",
                "toi da tham gia", "minh da dang ky", "minh da tham gia",
                "lich cua toi", "lich cua minh", "my event", "my activit",
                "my certificate", "thong bao cua toi", "dang ky cua toi");
        boolean personal = ownership && (event || activity
                || has(q, "dang ky", "lich", "chung nhan", "certificate",
                        "thong bao", "tham gia", "my event", "my activit"))
                && !has(q, "qr", "ma qr");
        boolean discovery = has(q, "nao", "nhung gi", "co gi", "hom nay", "ngay mai",
                "cuoi tuan", "tuan nay", "tuan sau", "thu bay", "chu nhat",
                "con cho", "cho trong", "con suat", "bao nhieu", "o dau", "khi nao",
                "lich", "sap toi");
        return new Intent(target, timeframe, availability, fullOnly, personal, howTo,
                discovery, q);
    }

    static Intent fromClassification(String original, ChatClassification classification) {
        Intent rules = resolve(original);
        String canonical = switch (classification.intent()) {
            case EVENT -> "su kien";
            case ACTIVITY -> "hoat dong";
            case BOTH -> "su kien hoat dong";
            case ACCOUNT -> "tai khoan";
            case EVENT_HELP -> "tham gia su kien";
            case ACTIVITY_HELP -> "hoat dong";
            case ATTENDANCE -> "diem danh";
            case CERTIFICATE -> "chung nhan";
            case BOOTH -> "gian hang";
            case NOTIFICATION -> "thong bao";
            case PERSONAL_EVENT -> "cua toi su kien";
            case PERSONAL_ACTIVITY -> "cua toi hoat dong";
            case UNKNOWN -> "";
        };
        Target target = switch (classification.intent()) {
            case EVENT -> Target.EVENT;
            case ACTIVITY -> Target.ACTIVITY;
            case BOTH -> Target.BOTH;
            default -> Target.NONE;
        };
        if (classification.availableOnly()) target = Target.ACTIVITY;
        boolean personal = classification.intent() == ChatClassification.Kind.PERSONAL_EVENT
                || classification.intent() == ChatClassification.Kind.PERSONAL_ACTIVITY;
        boolean howTo = switch (classification.intent()) {
            case ACCOUNT, EVENT_HELP, ACTIVITY_HELP, ATTENDANCE, CERTIFICATE,
                    BOOTH, NOTIFICATION -> true;
            default -> false;
        };
        return new Intent(target,
                rules.timeframe() != Timeframe.NONE ? rules.timeframe() : classification.timeframe(),
                rules.availability() || classification.availableOnly(), rules.fullOnly(),
                rules.personal() || personal, rules.howTo() || howTo,
                rules.discovery() || target != Target.NONE,
                (rules.query() + " " + canonical).trim());
    }

    static Timeframe timeframe(String q) {
        if (has(q, "hom nay", "bay gio")) return Timeframe.TODAY;
        if (has(q, "ngay mai")) return Timeframe.TOMORROW;
        if (has(q, "cuoi tuan sau", "cuoi tuan toi")) return Timeframe.NEXT_WEEKEND;
        if (has(q, "cuoi tuan", "weekend")) return Timeframe.THIS_WEEKEND;
        if (has(q, "tuan sau", "tuan toi")) return Timeframe.NEXT_WEEK;
        if (has(q, "tuan nay")) return Timeframe.THIS_WEEK;
        if (has(q, "thu bay")) return Timeframe.SATURDAY;
        if (has(q, "chu nhat")) return Timeframe.SUNDAY;
        return Timeframe.NONE;
    }

    static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").replace('đ', 'd').replaceAll("[^a-z0-9 ]", " ")
                .replaceAll(" +", " ").trim();
    }

    static boolean has(String q, String... phrases) {
        String padded = " " + q + " ";
        for (String phrase : phrases) if (padded.contains(" " + phrase + " ")) return true;
        return false;
    }
}
