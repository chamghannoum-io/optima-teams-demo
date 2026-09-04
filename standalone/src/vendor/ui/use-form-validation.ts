import { useState, useCallback } from "react";
import { z } from "zod";

export interface ValidationField {
  name: string;
  value: unknown;
  type?: "email" | "text" | "number" | "textarea";
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  pattern?: RegExp;
  customValidator?: (value: unknown) => string | undefined;
}

export interface FieldError {
  [fieldName: string]: string;
}

/**
 * Email validation schema
 */
const emailSchema = z.string().email("Invalid email format");

/**
 * Hook for form-level validation
 * Validates email format, text length constraints, and custom validators
 */
export function useFormValidation() {
  const [errors, setErrors] = useState<FieldError>({});

  /**
   * Validate email format
   */
  const validateEmail = useCallback((value: string): string | undefined => {
    const result = emailSchema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message || "Invalid email format";
    }
    return undefined;
  }, []);

  /**
   * Validate text input length
   */
  const validateTextLength = useCallback(
    (value: string, minLength?: number, maxLength?: number): string | undefined => {
      if (minLength && value.length < minLength) {
        return `Minimum ${minLength} characters required`;
      }
      if (maxLength && value.length > maxLength) {
        return `Maximum ${maxLength} characters allowed`;
      }
      return undefined;
    },
    []
  );

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (field: ValidationField): string | undefined => {
      const {
        name,
        value,
        type = "text",
        minLength,
        maxLength,
        required,
        pattern,
        customValidator,
      } = field;

      // Handle required fields
      if (required && (!value || (typeof value === "string" && !value.trim()))) {
        return `${name} is required`;
      }

      // Skip validation if value is empty and not required
      if (!value || (typeof value === "string" && !value.trim())) {
        return undefined;
      }

      const stringValue = String(value);

      // Email validation
      if (type === "email") {
        const emailError = validateEmail(stringValue);
        if (emailError) return emailError;
      }

      // Text/Textarea length validation
      if (type === "text" || type === "textarea") {
        const lengthError = validateTextLength(stringValue, minLength, maxLength);
        if (lengthError) return lengthError;
      }

      // Pattern validation
      if (pattern && !pattern.test(stringValue)) {
        return `${name} format is invalid`;
      }

      // Custom validator
      if (customValidator) {
        const customError = customValidator(value);
        if (customError) return customError;
      }

      return undefined;
    },
    [validateEmail, validateTextLength]
  );

  /**
   * Validate multiple fields
   */
  const validateFields = useCallback(
    (fields: ValidationField[]): FieldError => {
      const newErrors: FieldError = {};

      for (const field of fields) {
        const error = validateField(field);
        if (error) {
          newErrors[field.name] = error;
        } else {
          delete newErrors[field.name];
        }
      }

      setErrors(newErrors);
      return newErrors;
    },
    [validateField]
  );

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback(
    (fieldName: string): string | undefined => {
      return errors[fieldName];
    },
    [errors]
  );

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Clear error for a specific field
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  return {
    errors,
    validateField,
    validateFields,
    validateEmail,
    validateTextLength,
    getFieldError,
    clearErrors,
    clearFieldError,
  };
}
