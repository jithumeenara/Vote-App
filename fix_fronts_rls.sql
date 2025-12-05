-- Allow authenticated users to INSERT into fronts
CREATE POLICY "Allow insert access for authenticated users" ON public.fronts
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to UPDATE fronts
CREATE POLICY "Allow update access for authenticated users" ON public.fronts
FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to DELETE fronts
CREATE POLICY "Allow delete access for authenticated users" ON public.fronts
FOR DELETE USING (auth.role() = 'authenticated');
