package com.swp391.bookstreet.activity.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.exception.ActivityApiException;
import com.swp391.bookstreet.activity.repository.ActivityProposalRepository;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.repository.ActivityRequestRepository;
import com.swp391.bookstreet.booth.entity.Location;
import com.swp391.bookstreet.booth.repository.LocationRepository;
import com.swp391.bookstreet.event.entity.Event;
import com.swp391.bookstreet.event.service.EventRootLockService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActivityLockServiceTests {
    private final EventRootLockService eventLocks = mock(EventRootLockService.class);
    private final LocationRepository locations = mock(LocationRepository.class);
    private final ActivityProposalRepository proposals = mock(ActivityProposalRepository.class);
    private final ActivityRepository activities = mock(ActivityRepository.class);
    private final ActivityRequestRepository requests = mock(ActivityRequestRepository.class);
    private final ActivityLockService service = new ActivityLockService(eventLocks, locations,
            proposals, activities, requests);

    @Test
    void locksEventBeforeDistinctLocationsInAscendingOrder() {
        Event event = mock(Event.class);
        Location second = mock(Location.class);
        Location fifth = mock(Location.class);
        when(eventLocks.lock(7L)).thenReturn(Optional.of(event));
        when(locations.findAllByIdForUpdateOrderById(List.of(2L, 5L)))
                .thenReturn(List.of(second, fifth));

        ActivityLockService.RootLocks result = service.lockRoot(7L, List.of(5L, 2L, 5L));

        assertThat(result.event()).isSameAs(event);
        assertThat(result.locations()).containsExactly(second, fifth);
        InOrder order = inOrder(eventLocks, locations);
        order.verify(eventLocks).lock(7L);
        order.verify(locations).findAllByIdForUpdateOrderById(List.of(2L, 5L));
    }

    @Test
    void failsWhenAnyRequestedLocationDoesNotExist() {
        when(eventLocks.lock(7L)).thenReturn(Optional.of(mock(Event.class)));
        when(locations.findAllByIdForUpdateOrderById(List.of(2L, 5L)))
                .thenReturn(List.of(mock(Location.class)));

        assertThatThrownBy(() -> service.lockRoot(7L, List.of(5L, 2L)))
                .isInstanceOfSatisfying(ActivityApiException.class, error ->
                        assertThat(error.getCode()).isEqualTo("LOCATION_NOT_FOUND"));
    }

    @Test
    void skipsLocationQueryWhenNoLocationIsRequested() {
        when(eventLocks.lock(7L)).thenReturn(Optional.of(mock(Event.class)));

        assertThat(service.lockRoot(7L, null).locations()).isEmpty();

        verify(eventLocks).lock(7L);
    }

    @Test
    void locksOwnedActivityInEventLocationActivityOrder() {
        ActivityRepository.ActivityRoute route = mock(ActivityRepository.ActivityRoute.class);
        Event event = mock(Event.class);
        Location second = mock(Location.class);
        Location fifth = mock(Location.class);
        Activity activity = mock(Activity.class);
        when(route.getEventId()).thenReturn(7L);
        when(activities.findRouteById(11L)).thenReturn(Optional.of(route));
        when(eventLocks.lockOwned(7L, 3L)).thenReturn(Optional.of(event));
        when(activities.findLocationIdById(11L)).thenReturn(Optional.of(5L));
        when(locations.findAllByIdForUpdateOrderById(List.of(2L, 5L)))
                .thenReturn(List.of(second, fifth));
        when(activities.findByIdForUpdate(11L)).thenReturn(Optional.of(activity));

        ActivityLockService.ActivityLocks result = service.lockOwnedActivity(
                11L, 3L, List.of(2L));

        assertThat(result.event()).isSameAs(event);
        assertThat(result.locations()).containsExactly(second, fifth);
        assertThat(result.activity()).isSameAs(activity);
        InOrder order = inOrder(activities, eventLocks, locations);
        order.verify(activities).findRouteById(11L);
        order.verify(eventLocks).lockOwned(7L, 3L);
        order.verify(activities).findLocationIdById(11L);
        order.verify(locations).findAllByIdForUpdateOrderById(List.of(2L, 5L));
        order.verify(activities).findByIdForUpdate(11L);
    }
}
