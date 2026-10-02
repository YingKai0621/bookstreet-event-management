package com.swp391.bookstreet.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class Utf8ByteLengthValidator implements ConstraintValidator<Utf8ByteLength, String> {

    private int maximumBytes;

    @Override
    public void initialize(Utf8ByteLength constraintAnnotation) {
        maximumBytes = constraintAnnotation.max();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }

        int byteLength = value.getBytes(StandardCharsets.UTF_8).length;
        return byteLength <= maximumBytes;
    }
}
