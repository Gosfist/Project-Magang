ALTER TABLE main_core
  ADD COLUMN router_nas_id INT UNSIGNED NULL AFTER parent_port_out,
  ADD INDEX main_core_router_nas_id_idx (router_nas_id),
  ADD CONSTRAINT main_core_router_nas_id_fkey
    FOREIGN KEY (router_nas_id) REFERENCES nas(id) ON DELETE SET NULL ON UPDATE CASCADE;
