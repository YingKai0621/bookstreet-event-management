package com.swp391.bookstreet.auth.service;

import com.swp391.bookstreet.auth.dto.UpdateProfileRequest;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProfileServiceTests {
    private final UserRepository users = mock(UserRepository.class);
    private final ProfileService service = new ProfileService(users);

    @Test
    void readsOnlyCurrentAccountAndPreservesAbsentEmailAndAvatar() {
        User user = new User("newreader", null, "hash", "New Reader");
        when(users.findById(42L)).thenReturn(Optional.of(user));
        var profile = service.get(42L);
        assertThat(profile.fullName()).isEqualTo("New Reader");
        assertThat(profile.email()).isNull();
        assertThat(profile.avatarUrl()).isNull();
        verify(users).findById(42L);
    }

    @Test
    void persistsNormalizedNamePhoneAndAvatarTogether() {
        User user = new User("reader", null, "hash", "Old Name");
        when(users.findByIdForUpdate(42L)).thenReturn(Optional.of(user));
        var profile = service.update(42L, new UpdateProfileRequest("  New   Name  ", " 0901234567 ", "data:image/png;base64,aGVsbG8="));
        verify(users).saveAndFlush(user);
        assertThat(profile.fullName()).isEqualTo("New Name");
        assertThat(profile.phone()).isEqualTo("0901234567");
        assertThat(profile.avatarUrl()).isEqualTo("data:image/png;base64,aGVsbG8=");
    }

    @Test
    void missingAccountDoesNotWriteAnything() {
        when(users.findByIdForUpdate(42L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.update(42L, new UpdateProfileRequest("New Name", null, null)))
                .isInstanceOf(ApiException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void databaseFailureIsNotReportedAsSuccessfulSave() {
        User user = new User("reader", null, "hash", "Old Name");
        when(users.findByIdForUpdate(42L)).thenReturn(Optional.of(user));
        doThrow(new IllegalStateException("Database unavailable")).when(users).saveAndFlush(user);
        assertThatThrownBy(() -> service.update(42L, new UpdateProfileRequest("New Name", null, null)))
                .isInstanceOf(IllegalStateException.class);
    }
}
