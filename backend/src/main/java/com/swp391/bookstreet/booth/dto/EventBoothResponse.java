package com.swp391.bookstreet.booth.dto;

import com.swp391.bookstreet.booth.entity.Booth;
import com.swp391.bookstreet.booth.entity.BoothAvailability;
import com.swp391.bookstreet.booth.entity.EventBoothConfig;
import java.math.BigDecimal;

public record EventBoothResponse(
        Long eventBoothConfigId,
        Long eventId,
        BoothResponse booth,
        BigDecimal rentalPrice,
        boolean enabled,
        BoothAvailability availability
) {
    public static EventBoothResponse configured(EventBoothConfig config,
            BoothAvailability availability) {
        return new EventBoothResponse(config.getEventBoothConfigId(), config.getEventId(),
                BoothResponse.from(config.getBooth()), config.getRentalPrice(), config.isEnabled(),
                availability);
    }

    public static EventBoothResponse unconfigured(Long eventId, Booth booth) {
        return new EventBoothResponse(null, eventId, BoothResponse.from(booth), null, false,
                BoothAvailability.UNAVAILABLE);
    }
}
