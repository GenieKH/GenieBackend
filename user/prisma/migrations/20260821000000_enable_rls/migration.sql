-- Enable Row Level Security on core tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;

-- Define Policies for User
CREATE POLICY "Users can only read their own profile"
ON "User"
FOR SELECT
USING (id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

CREATE POLICY "Users can only update their own profile"
ON "User"
FOR UPDATE
USING (id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Define Policies for Property
CREATE POLICY "Users can only create their own properties"
ON "Property"
FOR INSERT
WITH CHECK (owner_id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

CREATE POLICY "Users can only read their own properties"
ON "Property"
FOR SELECT
USING (owner_id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

CREATE POLICY "Users can only update their own properties"
ON "Property"
FOR UPDATE
USING (owner_id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

CREATE POLICY "Users can only delete their own properties"
ON "Property"
FOR DELETE
USING (owner_id::text = (current_setting('request.jwt.claims', true)::json->>'sub'));

-- Note: In a real environment, we also need policies for public viewing of active properties
