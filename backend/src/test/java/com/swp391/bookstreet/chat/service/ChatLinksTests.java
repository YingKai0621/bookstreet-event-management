package com.swp391.bookstreet.chat.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.bookstreet.chat.dto.ChatSource;
import java.util.List;
import org.junit.jupiter.api.Test;

class ChatLinksTests {
    private static ChatLinks.Candidate candidate(String name, String url, String context) {
        return new ChatLinks.Candidate(new ChatSource(name, url), name, context);
    }

    @Test
    void linksOnlyItemsTheAnswerMentionsInAnswerOrder() {
        var links = List.of(
                candidate("Ngày hội sách", "/su-kien/1", null),
                candidate("Không gian Sách, STEM và Công nghệ", "/su-kien/2", null),
                candidate("Lễ hội Văn học", "/su-kien/3", null));

        var result = ChatLinks.select("Có Không gian sách, STEM và công nghệ, rồi Ngày hội sách.",
                links, List.of(new ChatSource("Sự kiện", "/su-kien")));

        assertThat(result).extracting(ChatSource::url).containsExactly("/su-kien/2", "/su-kien/1");
    }

    @Test
    void shortenedNameWithCollisionIsResolvedByEventContext() {
        var links = List.of(
                candidate("Workshop giữ chỗ A - [Demo Scenarios] 01 - Đăng ký", "/su-kien/1",
                        "[Demo Scenarios] 01 - Đăng ký bình thường"),
                candidate("Workshop giữ chỗ A - [Demo Scenarios] 04 - Hết chỗ", "/su-kien/4",
                        "[Demo Scenarios] 04 - Một hoạt động hết chỗ"));

        var result = ChatLinks.select("Sự kiện Demo Scenarios 04 có Workshop giữ chỗ A, đã hết chỗ.",
                links, List.of());

        assertThat(result).extracting(ChatSource::url).containsExactly("/su-kien/4");
    }

    @Test
    void fallsBackToGenericSourcesWhenNothingSpecificIsMentioned() {
        var result = ChatLinks.select("Mình chưa tìm thấy hoạt động phù hợp.",
                List.of(candidate("Ngày hội sách", "/su-kien/1", null)),
                List.of(new ChatSource("Sự kiện", "/su-kien")));

        assertThat(result).extracting(ChatSource::url).containsExactly("/su-kien");
    }

    @Test
    void partialWordDoesNotCountAsMention() {
        var result = ChatLinks.select("Có Workshop AB vào sáng mai.",
                List.of(candidate("Workshop A", "/su-kien/1", null)), List.of());

        assertThat(result).isEmpty();
    }

    @Test
    void itemsOpeningTheSamePageProduceOneLink() {
        var links = List.of(candidate("Workshop giữ chỗ A", "/su-kien/4", null),
                candidate("Giao lưu giữ chỗ B", "/su-kien/4", null));

        var result = ChatLinks.select("Có Workshop giữ chỗ A và Giao lưu giữ chỗ B.", links,
                List.of(new ChatSource("Demo 04", "/su-kien/4")));

        assertThat(result).extracting(ChatSource::url).containsExactly("/su-kien/4");
    }

    @Test
    void eventContextMatchesWithoutBracketTag() {
        var links = List.of(
                candidate("Workshop dấu trang", "/su-kien/1", "[Demo Participant] Sách và sáng tạo"),
                candidate("Workshop dấu trang", "/su-kien/2", "[Demo Participant] Hội chợ sách gia đình"));

        var result = ChatLinks.select("Workshop dấu trang thuộc sự kiện Sách và sáng tạo.",
                links, List.of());

        assertThat(result).extracting(ChatSource::url).containsExactly("/su-kien/1");
    }

    @Test
    void capsAtFourLinks() {
        var links = List.of(candidate("Sự kiện Alpha", "/su-kien/1", null),
                candidate("Sự kiện Beta", "/su-kien/2", null),
                candidate("Sự kiện Gamma", "/su-kien/3", null),
                candidate("Sự kiện Delta", "/su-kien/4", null),
                candidate("Sự kiện Omega", "/su-kien/5", null));

        var result = ChatLinks.select("Sự kiện Alpha, Sự kiện Beta, Sự kiện Gamma, "
                + "Sự kiện Delta và Sự kiện Omega.", links, List.of());

        assertThat(result).hasSize(4);
    }
}
