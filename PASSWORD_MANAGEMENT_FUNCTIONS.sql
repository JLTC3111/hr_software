-- Server-side function to set temporary passwords for users
-- This function should be called from a Supabase Edge Function with admin privileges

-- Function to generate a random temporary password
CREATE OR REPLACE FUNCTION generate_temp_password()
RETURNS TEXT AS $$
DECLARE
    characters TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 12 character temporary password
    FOR i IN 1..12 LOOP
        result := result || substr(characters, floor(random() * length(characters) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Add special characters for complexity
    result := result || '@' || floor(random() * 100)::TEXT;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark user as needing password change
CREATE OR REPLACE FUNCTION mark_user_temp_password(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.hr_users 
    SET 
        must_change_password = TRUE,
        temporary_password_set_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear temporary password requirement when user changes password
CREATE OR REPLACE FUNCTION clear_temp_password_requirement(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.hr_users 
    SET 
        must_change_password = FALSE,
        password_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if temporary password has expired (30 days)
CREATE OR REPLACE FUNCTION is_temp_password_expired(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    temp_set_date TIMESTAMPTZ;
BEGIN
    SELECT temporary_password_set_at INTO temp_set_date
    FROM public.hr_users 
    WHERE id = user_id;
    
    IF temp_set_date IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Return true if more than 30 days have passed
    RETURN (NOW() - temp_set_date) > INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_temp_password() TO service_role;
GRANT EXECUTE ON FUNCTION mark_user_temp_password(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION clear_temp_password_requirement(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION is_temp_password_expired(UUID) TO service_role;