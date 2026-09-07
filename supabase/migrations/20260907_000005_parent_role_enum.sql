-- Adding an enum value must happen outside the transaction that first uses
-- it, so this migration does nothing else.
alter type public.app_role add value if not exists 'parent';
