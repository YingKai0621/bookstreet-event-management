package com.swp391.bookstreet.notification.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class NotificationAsyncConfiguration {
    public static final String LIVE_UPDATE_EXECUTOR = "notificationLiveUpdateExecutor";

    private static final Logger LOGGER =
            LoggerFactory.getLogger(NotificationAsyncConfiguration.class);

    @Bean(name = LIVE_UPDATE_EXECUTOR)
    public Executor notificationLiveUpdateExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(1000);
        executor.setThreadNamePrefix("notification-live-");
        // A dropped signal only delays the display: the durable row is read on the next refresh.
        executor.setRejectedExecutionHandler((task, pool) ->
                LOGGER.warn("Notification live update dropped because the queue is full."));
        executor.initialize();
        return executor;
    }
}
