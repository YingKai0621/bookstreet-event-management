package com.swp391.bookstreet.activity.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class ActivityAsyncConfiguration {
    public static final String PARTNER_MAIL_EXECUTOR = "activityPartnerMailExecutor";

    private static final Logger LOGGER =
            LoggerFactory.getLogger(ActivityAsyncConfiguration.class);

    @Bean(name = PARTNER_MAIL_EXECUTOR)
    public Executor activityPartnerMailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("activity-partner-mail-");
        executor.setRejectedExecutionHandler((task, pool) ->
                LOGGER.warn("Activity Partner email task dropped because the mail queue is full."));
        executor.initialize();
        return executor;
    }
}
