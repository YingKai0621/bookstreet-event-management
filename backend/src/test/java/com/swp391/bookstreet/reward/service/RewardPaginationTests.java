package com.swp391.bookstreet.reward.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.Test;

class RewardPaginationTests {
    @Test
    void validatesPageSizeSortAndPositiveFiltersWithCanonicalCodes() {
        assertCode(() -> RewardPagination.points(-1, 20, null), "INVALID_PAGE");
        assertCode(() -> RewardPagination.points(0, 0, null), "INVALID_SIZE");
        assertCode(() -> RewardPagination.points(0, 20, "eventName,asc"), "INVALID_SORT");
        assertCode(() -> RewardPagination.badges(0, 20, "earnedAt,sideways"),
                "INVALID_SORT");
        assertCode(() -> RewardPagination.positiveFilter(0L), "INVALID_FILTER");
    }

    @Test
    void calculatesLargeOffsetsWithoutIntegerOverflow() {
        RewardPagination pagination = RewardPagination.points(
                Integer.MAX_VALUE, 100, "visitedAt,asc");

        assertThat(pagination.offset()).isEqualTo((long) Integer.MAX_VALUE * 100);
        assertThat(pagination.pointOrderBy())
                .isEqualTo("visit.visitedAt asc, pointTransaction.pointTransactionId desc");
    }

    private static void assertCode(
            org.assertj.core.api.ThrowableAssert.ThrowingCallable call, String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(code));
    }
}
