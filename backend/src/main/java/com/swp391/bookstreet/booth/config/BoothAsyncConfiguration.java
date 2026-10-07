package com.swp391.bookstreet.booth.config;

import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class BoothAsyncConfiguration {
    public static final String SELECTION_MAIL_EXECUTOR = "boothSelectionMailExecutor";

    private static final Logger LOGGER =
            LoggerFactory.getLogger(BoothAsyncConfiguration.class);

    @Bean(name = SELECTION_MAIL_EXECUTOR)
    public Executor boothSelectionMailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("booth-selection-mail-");
        executor.setRejectedExecutionHandler((task, pool) ->
                LOGGER.warn("Selection email task dropped because the mail queue is full."));
        executor.initialize();
        return executor;
    }
}
