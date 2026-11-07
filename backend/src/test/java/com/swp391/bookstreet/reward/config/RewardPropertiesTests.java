package com.swp391.bookstreet.reward.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class RewardPropertiesTests {
    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class);

    @Test
    void approvedPositiveValueBinds() {
        contextRunner.withPropertyValues("rewards.booth-visit-points=10")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(RewardProperties.class).getBoothVisitPoints())
                            .isEqualTo(10);
                });
    }

    @Test
    void absentValueFailsStartupValidation() {
        contextRunner.run(context -> assertThat(context).hasFailed());
    }

    @Test
    void zeroAndNegativeValuesFailStartupValidation() {
        contextRunner.withPropertyValues("rewards.booth-visit-points=0")
                .run(context -> assertThat(context).hasFailed());
        contextRunner.withPropertyValues("rewards.booth-visit-points=-1")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void malformedValueFailsStartupBinding() {
        contextRunner.withPropertyValues("rewards.booth-visit-points=ten")
                .run(context -> assertThat(context).hasFailed());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(RewardProperties.class)
    static class TestConfiguration {
    }
}
