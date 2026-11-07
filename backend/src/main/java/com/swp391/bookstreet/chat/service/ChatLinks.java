package com.swp391.bookstreet.chat.service;

import com.swp391.bookstreet.chat.dto.ChatSource;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Deep links for individual tool results. The server builds every URL from ids it looked up
 * itself; a link is shown only when the model's answer actually mentions that item.
 */
final class ChatLinks {
    private static final int MAX_LINKS = 4;

    /**
     * @param name    item name as stored, e.g. "Workshop A - [Demo Scenarios] 01 - Đăng ký"
     * @param context optional parent name (the event of an activity) used to tell apart
     *                items whose short names collide; may be null
     */
    record Candidate(ChatSource source, String name, String context) {
    }

    private ChatLinks() {
    }

    /** Links for items the answer mentions, in answer order, then generic sources; max 4. */
    static List<ChatSource> select(String answer, List<Candidate> candidates,
            Iterable<ChatSource> generic) {
        String text = " " + ChatTools.normalize(answer) + " ";
        // Group mentioned candidates by the key they matched, so colliding short names
        // ("Workshop A" in several events) can be disambiguated by their event name.
        Map<String, List<Candidate>> byKey = new LinkedHashMap<>();
        for (Candidate candidate : candidates) {
            String key = matchedKey(text, candidate.name());
            if (key != null) byKey.computeIfAbsent(key, ignored -> new ArrayList<>()).add(candidate);
        }
        List<Mention> mentions = new ArrayList<>();
        for (var entry : byKey.entrySet()) {
            List<Candidate> group = distinctByUrl(entry.getValue());
            List<Candidate> chosen = group.size() == 1 ? group : group.stream()
                    .filter(candidate -> candidate.context() != null
                            && matchedKey(text, candidate.context()) != null)
                    .toList();
            for (Candidate candidate : chosen) {
                mentions.add(new Mention(text.indexOf(" " + entry.getKey() + " "),
                        candidate.source()));
            }
        }
        mentions.sort((left, right) -> Integer.compare(left.position(), right.position()));

        // Several items can open the same page (activities open their event page): one link each.
        Map<String, ChatSource> byUrl = new LinkedHashMap<>();
        for (Mention mention : mentions) {
            if (byUrl.size() >= MAX_LINKS) break;
            byUrl.putIfAbsent(mention.source().url(), mention.source());
        }
        Set<ChatSource> result = new LinkedHashSet<>(byUrl.values());
        for (ChatSource source : generic) {
            if (result.size() >= MAX_LINKS) break;
            // A specific page already covers the generic list page it belongs to.
            if (result.stream().noneMatch(chosen -> chosen.url().equals(source.url())
                    || chosen.url().startsWith(source.url() + "/")
                    || chosen.url().startsWith(source.url() + "?"))) {
                result.add(source);
            }
        }
        return List.copyOf(result);
    }

    /** Returns the normalized key (full name, or the part before " - ") found in the text. */
    private static String matchedKey(String paddedText, String name) {
        if (name == null) return null;
        // Answers shorten names: "[Demo] Sách và sáng tạo" -> "Sách và sáng tạo",
        // "Workshop A - [Demo] 01 - ..." -> "Workshop A". Try longest forms first.
        String untagged = name.replaceFirst("^\\s*\\[[^\\]]*\\]\\s*", "");
        int dash = name.indexOf(" - ");
        List<String> forms = new ArrayList<>(List.of(name, untagged));
        if (dash > 0) forms.add(name.substring(0, dash));
        for (String form : forms) {
            String key = ChatTools.normalize(form);
            if (key.length() >= 4 && paddedText.contains(" " + key + " ")) return key;
        }
        return null;
    }

    private static List<Candidate> distinctByUrl(List<Candidate> group) {
        Map<String, Candidate> unique = new LinkedHashMap<>();
        for (Candidate candidate : group) unique.putIfAbsent(candidate.source().url(), candidate);
        return List.copyOf(unique.values());
    }

    private record Mention(int position, ChatSource source) {
    }
}
